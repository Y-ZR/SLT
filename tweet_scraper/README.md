# Twitter Scraper CLI Documentation

This script provides a command-line interface for scraping tweets based on predefined groups
and their keywords stored in Redis Upstash.

## Environment Variables Required

- `TWITTER_TOKEN`: Your Twitter API token
- `TWITTER_API_BASE`: Base URL for Twitter API
- `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token
- `SCRAPER_MAX_RESULTS`: Maximum number of results to return per query

## Available Commands

### 1. List All Groups
Shows all available groups and their associated keywords from Redis
```bash
python scraper.py --list
```

### 2. Scrape Tweets for a Specific Group
Fetches tweets for a given group using its predefined keywords
```bash
python scraper.py --group GROUP_NAME
```
Example:
```bash
python scraper.py --group KYB
python scraper.py --group Card
python scraper.py --group KYC
```

### 3. Scrape Tweets with Date Range
Fetches tweets for a group within a specific date range
```bash
python scraper.py --group GROUP_NAME --start-date YYYY-MM-DD --end-date YYYY-MM-DD
```
Example:
```bash
python scraper.py --group KYB --start-date 2024-01-01 --end-date 2024-01-31
```

### 4. Scrape Tweets for All Groups
Fetches tweets for all available groups using their predefined keywords
```bash
python scraper.py --all
```

You can also specify a date range when scraping all groups:
```bash
python scraper.py --all --start-date 2024-01-01 --end-date 2024-01-31
```

## Arguments

- `--group`: Name of the group to scrape tweets for (must exist in Redis)
- `--list`: List all available groups and their keywords
- `--all`: Scrape tweets for all available groups
- `--start-date`: Start date for tweet search (format: YYYY-MM-DD)
- `--end-date`: End date for tweet search (format: YYYY-MM-DD)

## Notes

- If no dates are specified, the script defaults to the last 7 days
- The script automatically skips tweets from suspended accounts
- Tweets are deduplicated before storing in Redis using HSETNX
- All tweets are stored in Redis under the key pattern: `tweets:<group_name>` 