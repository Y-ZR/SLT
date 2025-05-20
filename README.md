# SLT - Social Listening Tool

This is a social listening tool that scrapes tweets based on predefined keywords and displays them in a web interface.

## Initial Setup

### Frontend Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory (request this file from ZR, the project owner and dev lead).

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Tweet Scraper Setup

1. Navigate to the tweet_scraper directory:
```bash
cd tweet_scraper
```

2. Create and activate a Python virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate on macOS/Linux
source venv/bin/activate

# Activate on Windows
# venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Ensure you have the required environment variables:
   - `TWITTER_TOKEN`: Your Twitter API token
   - `TWITTER_API_BASE`: Base URL for Twitter API
   - `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
   - `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token

   Note: Request the .env file from ZR if you don't have these credentials.

## Daily Usage Workflow for Social Listening

1. Open two command-line interface windows.

2. In the first window, start the frontend:
```bash
# In the project root directory
npm run dev
```

3. In the second window, run the tweet scraper:
```bash
# Navigate to the tweet_scraper directory
cd tweet_scraper

# Activate the virtual environment
source venv/bin/activate  # on macOS/Linux
# venv\Scripts\activate   # on Windows

# Run the scraper for all groups
python scraper.py --all
```

4. Navigate to the locally running frontend at [http://localhost:3000](http://localhost:3000) to view and interact with the scraped tweets.

## Tweet Scraper Commands

### List All Groups
```bash
python scraper.py --list
```

### Scrape Tweets for a Specific Group
```bash
python scraper.py --group GROUP_NAME
```

### Scrape Tweets with Date Range
```bash
python scraper.py --group GROUP_NAME --start-date YYYY-MM-DD --end-date YYYY-MM-DD
```

### Scrape Tweets for All Groups
```bash
python scraper.py --all
```

For more details on the tweet scraper, refer to the [Tweet Scraper README](./tweet_scraper/README.md).

