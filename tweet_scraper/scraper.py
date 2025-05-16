import json
import urllib.parse
import os
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests
from dotenv import load_dotenv
import time

load_dotenv()
TOKEN = os.getenv("TWITTER_TOKEN")
API_BASE = os.getenv("TWITTER_API_BASE")
UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
SCRAPER_MAX_RESULTS = os.getenv("SCRAPER_MAX_RESULTS", "100")  # Default to 100 if not set

# Ensure max_results is within Twitter API limits (5-100)
try:
    SCRAPER_MAX_RESULTS = min(max(int(SCRAPER_MAX_RESULTS), 5), 100)
except (ValueError, TypeError):
    SCRAPER_MAX_RESULTS = 100

HEADERS_UPS = {
    "Authorization": f"Bearer {UPSTASH_TOKEN}",
    "Content-Type": "application/json"
}


def get_groups_from_upstash() -> dict:
    """Fetch groups and their keywords from Upstash Redis."""
    url = f"{UPSTASH_URL}/hgetall/groups"
    response = requests.get(url, headers=HEADERS_UPS, timeout=10)
    response.raise_for_status()
    result = response.json().get("result", [])
    
    # Convert the flat list [key1, value1, key2, value2, ...] to a dictionary
    groups_dict = {}
    for i in range(0, len(result), 2):
        if i + 1 < len(result):
            groups_dict[result[i]] = result[i + 1]
    return groups_dict


def upstash_hsetnx(group: str, tweet_id: str, payload: dict) -> bool:
    """HSETNX tweets:<group> <tweet_id> <payload> (dedup).
    Returns True if the tweet was stored, False if it was a duplicate."""
    url = f"{UPSTASH_URL}/hsetnx/tweets:{group}/{tweet_id}"
    json_payload = json.dumps(payload)
    response = requests.post(url, headers=HEADERS_UPS, data=json_payload, timeout=10)
    response.raise_for_status()
    # HSETNX returns 1 if set, 0 if already exists
    return response.json().get("result", 0) == 1


def process_tweets_response(response_data: dict, group: str) -> None:
    """Process tweets from API response and store in Redis."""
    if "data" not in response_data:
        return
        
    users = {}
    suspended_users = set()
    
    if "includes" in response_data and "users" in response_data["includes"]:
        for user in response_data["includes"]["users"]:
            # Check if user is suspended or withheld
            if user.get("withheld") or not user.get("username"):
                suspended_users.add(user["id"])
            else:
                users[user["id"]] = user

    stored_count = 0
    duplicate_count = 0
    
    for tweet in response_data["data"]:
        tid = tweet["id"]
        author_id = tweet.get("author_id")
        
        # Skip tweets from suspended accounts
        if author_id in suspended_users:
            print(f"Skipping tweet {tid} from suspended account {author_id}")
            continue
            
        if author_id in users:
            user = users[author_id]
            tweet["author_name"] = user.get("name", "")
            tweet["author_username"] = user.get("username", "")
            tweet["profile_image_url"] = user.get("profile_image_url", "")
        else:
            # Skip if we can't find user info (likely suspended/withheld)
            print(f"Skipping tweet {tid} - user info not available")
            continue

        tweet["url"] = f"https://twitter.com/i/web/status/{tid}"
        
        tweet_data = {
            "id": tweet["id"],
            "text": tweet["text"],
            "author_id": tweet["author_id"],
            "created_at": tweet["created_at"],
            "author_name": tweet.get("author_name", ""),
            "author_username": tweet.get("author_username", ""),
            "profile_image_url": tweet.get("profile_image_url", ""),
            "public_metrics": tweet.get("public_metrics", {}),
            "url": tweet["url"]
        }

        try:
            if upstash_hsetnx(group, tid, tweet_data):
                print(f"✅ Stored new tweet {tid} in Upstash (group={group})")
                stored_count += 1
            else:
                print(f"⏭️  Skipped duplicate tweet {tid} (group={group})")
                duplicate_count += 1
        except Exception as e:
            print(f"❌ Error storing tweet {tid}: {e}")
            
    print(f"\nSummary for this batch:")
    print(f"New tweets stored: {stored_count}")
    print(f"Duplicates skipped: {duplicate_count}")
    print("-" * 50)


def get_tweets(
    query: str = "binance kyb",
    group: str = "KYB",
    start_date: str | None = None,
    end_date: str | None = None,
    output_file: str = "tweets.json",
):
    today = datetime.now(timezone.utc).date()
    future_year = 2025  # ← keep if you still need the hack
    today = today.replace(year=future_year)

    if not end_date:
        end_date = today.strftime("%Y-%m-%d")
    if not start_date:
        start_date = (today - timedelta(days=6)).strftime("%Y-%m-%d")

    start_iso = f"{start_date}T00:00:00Z"
    end_iso = f"{end_date}T00:00:00Z"
    
    # Split the query string into individual keyword phrases
    keyword_phrases = [kw.strip() for kw in query.split(",")]
    print(f"\nSearching for {len(keyword_phrases)} keyword phrases:")
    
    all_responses = []
    headers = {"authorization": TOKEN}
    
    for keyword in keyword_phrases:
        print(f"\nSearching for: {keyword}")
        encoded_query = urllib.parse.quote(keyword)
        
        url = (
            f"{API_BASE}?tweet.fields=author_id,text,created_at,lang,public_metrics"
            f"&expansions=author_id"
            f"&user.fields=name,username,profile_image_url,withheld"
            f"&bu=futures&query={encoded_query}"
            f"&start_time={start_iso}&end_time={end_iso}"
            f"&max_results={SCRAPER_MAX_RESULTS}"
        )

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response_data = response.json()
            
            if "errors" in response_data:
                print(f"Error searching for '{keyword}': {response_data['errors']}")
                continue
                
            process_tweets_response(response_data, group)
            all_responses.append(response_data)
            
            # Check rate limits
            remaining = int(response.headers.get("x-rate-limit-remaining", 0))
            reset_time = int(response.headers.get("x-rate-limit-reset", 0))
            if remaining == 0:
                reset_datetime = datetime.fromtimestamp(reset_time)
                wait_time = (reset_datetime - datetime.now()).total_seconds()
                if wait_time > 0:
                    print(f"\nRate limit reached. Waiting {wait_time:.0f} seconds...")
                    time.sleep(wait_time + 1)
                    
        except Exception as e:
            print(f"Error processing keyword '{keyword}': {e}")
            continue

    # Save all responses to the output file
    combined_response = {
        "keyword_searches": dict(zip(keyword_phrases, all_responses))
    }
    Path(output_file).write_text(json.dumps(combined_response, indent=2), encoding="utf-8")
    print(f"\nAll responses saved to {output_file}")
    return combined_response


def list_groups():
    """List all available groups and their keywords."""
    groups = get_groups_from_upstash()
    if not groups:
        print("No groups found in Redis")
        return
    
    print("\nAvailable groups:")
    print("-" * 50)
    for group_name, keywords in groups.items():
        print(f"Group: {group_name}")
        print(f"Keywords: {keywords}")
        print("-" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Twitter Scraper CLI")
    parser.add_argument("--group", type=str, help="Group name to scrape tweets for")
    parser.add_argument("--list", action="store_true", help="List all available groups")
    parser.add_argument("--start-date", type=str, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="End date (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    if args.list:
        list_groups()
    elif args.group:
        groups = get_groups_from_upstash()
        if args.group not in groups:
            print(f"Error: Group '{args.group}' not found. Use --list to see available groups.")
            exit(1)
            
        print(f"Scraping tweets for group: {args.group}")
        print(f"Using keywords: {groups[args.group]}")
        get_tweets(
            query=groups[args.group],
            group=args.group,
            start_date=args.start_date,
            end_date=args.end_date
        )
    else:
        parser.print_help()
