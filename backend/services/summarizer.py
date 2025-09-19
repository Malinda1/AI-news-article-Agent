from typing import List, Dict
from backend.models.llm_client import llm_client
from backend.services.news_scrapper import news_scraper
from backend.logger import logger

class SummarizerService:
    def __init__(self):
        logger.info("Initialized Summarizer Service")
    
    async def process_news_articles(self, articles: List[Dict]) -> List[Dict]:
        """Process and summarize news articles"""
        processed_articles = []
        
        for article in articles:
            try:
                # Extract additional content if needed
                article_content = article.get('snippet', '')
                if len(article_content) < 100:  # If snippet is too short
                    article_content = await news_scraper.extract_article_content(article['link'])
                
                # Generate summary using LLM
                summary = await llm_client.generate_summary(
                    article_content, 
                    article['title']
                )
                
                # Add summary to article
                article['summary'] = summary
                article['processed'] = True
                
                processed_articles.append(article)
                logger.info(f"Processed article: {article['title'][:50]}...")
                
            except Exception as e:
                logger.error(f"Error processing article {article['title']}: {str(e)}")
                # Add article without summary if processing fails
                article['summary'] = article.get('snippet', 'Summary unavailable')
                article['processed'] = False
                processed_articles.append(article)
        
        logger.info(f"Successfully processed {len(processed_articles)} articles")
        return processed_articles

# Global summarizer instance
summarizer = SummarizerService()