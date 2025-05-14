import json
import urllib.parse
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("TWITTER_TOKEN")
API_BASE = os.getenv("TWITTER_API_BASE")
UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
SCRAPER_MAX_RESULTS = os.getenv("SCRAPER_MAX_RESULTS")

HEADERS_UPS = {
    "Authorization": f"Bearer {UPSTASH_TOKEN}",
    "Content-Type": "application/json"
}


def upstash_hsetnx(group: str, tweet_id: str, payload: dict) -> None:
    """HSETNX tweets:<group> <tweet_id> <payload> (dedup)."""
    url = f"{UPSTASH_URL}/hsetnx/tweets:{group}/{tweet_id}"
    json_payload = json.dumps(payload)
    requests.post(url, headers=HEADERS_UPS, data=json_payload, timeout=10).raise_for_status()


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
    encoded_query = urllib.parse.quote(query)

    url = (
        f"{API_BASE}?tweet.fields=author_id,text,created_at,lang,public_metrics"
        f"&expansions=author_id"
        f"&user.fields=name,username,profile_image_url"
        f"&bu=futures&query={encoded_query}"
        f"&start_time={start_iso}&end_time={end_iso}&max_results={SCRAPER_MAX_RESULTS}"
    )

    headers = {"authorization": TOKEN}
    response = requests.get(url, headers=headers, timeout=30)
    response_data = response.json()

    if "data" in response_data:
        # Create a map of user data
        users = {}
        if "includes" in response_data and "users" in response_data["includes"]:
            for user in response_data["includes"]["users"]:
                users[user["id"]] = user

        for tweet in response_data["data"]:
            tid = tweet["id"]
            # Add user data to tweet
            if tweet.get("author_id") in users:
                user = users[tweet["author_id"]]
                tweet["author_name"] = user.get("name", "")
                tweet["author_username"] = user.get("username", "")
                tweet["profile_image_url"] = user.get("profile_image_url", "")

            tweet["url"] = f"https://twitter.com/i/web/status/{tid}"
            
            # Clean up the tweet object to ensure it's JSON serializable
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
                upstash_hsetnx(group, tid, tweet_data)
                print(f"Stored tweet {tid} in Upstash (group={group})")
            except Exception as e:
                print(f"Error storing tweet {tid}: {e}")

    Path(output_file).write_text(json.dumps(response_data, indent=2), encoding="utf-8")
    print(f"Tweets saved to {output_file}")
    return response_data


if __name__ == "__main__":
    # example: get_tweets(group="KYB", query="binance kyb")
    get_tweets()
