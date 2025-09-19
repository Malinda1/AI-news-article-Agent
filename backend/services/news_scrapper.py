import requests
from datetime import datetime, timedelta
from typing import List, Dict
from backend.logger import logger
from backend.utils.config import config

class NewsScraperService:
    def __init__(self):
        self.api_key = config.SERP_API_KEY
        self.base_url = "https://serpapi.com/search"
        logger.info("Initialized News Scraper Service")
    
    async def search_ai_news(self, query: str = "latest AI news", days_back: int = 1) -> List[Dict]:
        """Search for AI news using SERP API"""
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            params = {
                "engine": "google",
                "q": f"{query} after:{start_date.strftime('%Y-%m-%d')}",
                "api_key": self.api_key,
                "tbm": "nws",  # News search
                "num": 10,     # Get 10 results to filter to top 5
                "sort": "date"
            }
            
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            news_results = data.get("news_results", [])
            
            # Process and filter results
            processed_news = []
            for item in news_results[:5]:  # Get top 5 results
                news_item = {
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "link": item.get("link", ""),
                    "source": item.get("source", ""),
                    "date": item.get("date", ""),
                    "thumbnail": item.get("thumbnail", "")
                }
                processed_news.append(news_item)
            
            logger.info(f"Successfully scraped {len(processed_news)} AI news articles")
            return processed_news
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching news from SERP API: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in news scraping: {str(e)}")
            return []
    
    async def extract_article_content(self, url: str) -> str:
        """Extract full article content from URL"""
        try:
            # Basic content extraction (you can enhance this with BeautifulSoup)
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            # For now, return the first 1000 characters as content
            # You can implement proper HTML parsing here
            content = response.text[:1000]
            logger.info(f"Extracted content from: {url}")
            return content
            
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {str(e)}")
            return "Content extraction failed"

# Global news scraper instance
news_scraper = NewsScraperService()