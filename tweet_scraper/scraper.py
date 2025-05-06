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

HEADERS_UPS = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}


def upstash_hsetnx(group: str, tweet_id: str, payload: str) -> None:
    """HSETNX tweets:<group> <tweet_id> <payload> (dedup)."""
    url = f"{UPSTASH_URL}/hsetnx/tweets:{group}/{tweet_id}"
    requests.post(url, headers=HEADERS_UPS, data=payload, timeout=10).raise_for_status()


def get_tweets(
    query: str = "binance kyb",
    group: str = "KYB",
    start_date: str | None = None,
    end_date: str | None = None,
    output_file: str = "tweets.json",
):
    today = datetime.now(timezone.utc).date()
    future_year = 2025                       # ← keep if you still need the hack
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
    response_data = response.json()

    if "data" in response_data:
        for tweet in response_data["data"]:
            tid = tweet["id"]
            tweet["url"] = f"https://twitter.com/i/web/status/{tid}"

            try:
                upstash_hsetnx(group, tid, json.dumps(tweet))
                print(f"Stored tweet {tid} in Upstash (group={group})")
            except Exception as e:
                print(f"Error storing tweet {tid}: {e}")

    Path(output_file).write_text(json.dumps(response_data, indent=2), encoding="utf-8")
    print(f"Tweets saved to {output_file}")
    return response_data


if __name__ == "__main__":
    # example: get_tweets(group="KYB", query="binance kyb")
    get_tweets()
