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
UPSTASH_URL   = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
SCRAPER_MAX_RESULTS = os.getenv("SCRAPER_MAX_RESULTS")

HEADERS_UPS = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}

def upstash_hsetnx(hash_key: str, field: str, payload: str) -> None:
    """Write payload to Upstash if field doesn't exist (dedupe)."""
    url = f"{UPSTASH_URL}/hsetnx/{hash_key}/{field}"
    r = requests.post(url, headers=HEADERS_UPS, data=payload, timeout=10)
    r.raise_for_status()

def get_tweets(query="binance kyb", start_date=None, end_date=None, output_file="tweets.json"):
    """Query tweets and save them to a JSON file.
    
    Args:
        query: Search query string
        start_date: Start date (YYYY-MM-DD) or None for 6 days ago
        end_date: End date (YYYY-MM-DD) or None for today
        output_file: Path to save the JSON output
    """
    today = datetime.now(timezone.utc).date()
    future_year = 2025
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
        f"&bu=futures&query={encoded_query}"
        f"&start_time={start_iso}&end_time={end_iso}&max_results={SCRAPER_MAX_RESULTS}"
    )
    
    headers = {"authorization": TOKEN}
    response = requests.get(url, headers=headers, timeout=30)
    
    # Parse the JSON response
    response_data = response.json()
    
    # Add tweet URLs to each tweet and store in Upstash
    if "data" in response_data:
        for tweet in response_data["data"]:
            tweet_id = tweet["id"]
            tweet["url"] = f"https://twitter.com/i/web/status/{tweet_id}"
            
            # Store tweet in Upstash Redis
            try:
                # Use tweet_id as field name, tweet as JSON payload
                upstash_hsetnx("tweets", tweet_id, json.dumps(tweet))
                print(f"Stored tweet {tweet_id} in Upstash Redis")
            except Exception as e:
                print(f"Error storing tweet {tweet_id} in Upstash: {e}")
    
    # Write the modified response to file
    Path(output_file).write_text(json.dumps(response_data, indent=2), encoding="utf-8")
    print(f"Tweets saved to {output_file}")
    
    return response_data

if __name__ == "__main__":
    get_tweets()
