from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import re
from dateutil import parser

from backend.services.news_scrapper import news_scraper
from backend.services.summarizer import summarizer
from backend.services.embeddings import embedding_service
from backend.services.vector_db import vector_db
from backend.models.llm_client import llm_client
from backend.logger import logger

router = APIRouter()

class NewsRequest(BaseModel):
    query: str = "latest AI news"

class QuestionRequest(BaseModel):
    question: str

class NewsResponse(BaseModel):
    articles: List[dict]
    total_count: int
    processed_at: str

class DateParser:
    @staticmethod
    def extract_date_from_query(query: str) -> tuple:
        """
        Extract date information from natural language query
        Returns: (cleaned_query, days_back, specific_date)
        """
        # Patterns to match various date formats
        date_patterns = [
            r'(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))',
            r'((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})',
            r'(\d{1,2}\/\d{1,2}\/\d{4})',
            r'(\d{4}-\d{1,2}-\d{1,2})',
            r'(\d{1,2}-\d{1,2}-\d{4})',
            r'(today)',
            r'(yesterday)',
            r'(last\s+week)',
            r'(last\s+month)',
            r'(past\s+\d+\s+days?)',
            r'(\d+\s+days?\s+ago)',
        ]
        
        # Time-based keywords
        time_keywords = {
            'today': 1,
            'yesterday': 2,
            'last week': 7,
            'past week': 7,
            'last month': 30,
            'past month': 30,
        }
        
        query_lower = query.lower()
        original_query = query
        specific_date = None
        days_back = 7  # default
        
        # Check for specific date patterns
        for pattern in date_patterns:
            match = re.search(pattern, query_lower, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                
                # Handle time keywords
                if date_str in time_keywords:
                    days_back = time_keywords[date_str]
                    # Remove the time reference from query
                    query = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
                    break
                
                # Handle "X days ago" pattern
                elif 'days ago' in date_str or 'day ago' in date_str:
                    days_match = re.search(r'(\d+)', date_str)
                    if days_match:
                        days_back = int(days_match.group(1)) + 1
                        query = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
                        break
                
                # Handle "past X days" pattern
                elif 'past' in date_str and 'days' in date_str:
                    days_match = re.search(r'(\d+)', date_str)
                    if days_match:
                        days_back = int(days_match.group(1))
                        query = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
                        break
                
                # Try to parse as specific date
                else:
                    try:
                        # Add current year if not specified
                        current_year = datetime.now().year
                        if not re.search(r'\d{4}', date_str):
                            date_str = f"{date_str} {current_year}"
                        
                        parsed_date = parser.parse(date_str, fuzzy=True)
                        specific_date = parsed_date.date()
                        
                        # Calculate days back from specific date
                        today = datetime.now().date()
                        delta = today - specific_date
                        days_back = max(1, delta.days + 1)  # +1 to include the target date
                        
                        # Remove date from query
                        query = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
                        break
                        
                    except (ValueError, parser.ParserError):
                        # If parsing fails, continue with default
                        continue
        
        # Clean up the query
        query = re.sub(r'\s+', ' ', query).strip()
        if not query or query.lower() in ['news', 'latest', 'recent']:
            query = "AI news"
        
        return query, days_back, specific_date

@router.post("/get-news", response_model=NewsResponse)
async def get_ai_news(request: NewsRequest):
    """Get latest AI news, summarize, and store in vector database"""
    try:
        logger.info(f"Processing news request: {request.query}")
        
        # Parse the query for date information
        parsed_query, days_back, specific_date = DateParser.extract_date_from_query(request.query)
        
        logger.info(f"Parsed query: '{parsed_query}', days_back: {days_back}, specific_date: {specific_date}")
        
        # Add date context to the search if specific date was mentioned
        if specific_date:
            # Enhance the query with date information for better search results
            date_str = specific_date.strftime("%B %d, %Y")
            enhanced_query = f"{parsed_query} {date_str}"
            logger.info(f"Enhanced query with date: {enhanced_query}")
        else:
            enhanced_query = parsed_query
        
        # 1. Search for news
        articles = await news_scraper.search_ai_news(enhanced_query, days_back)
        
        if not articles:
            raise HTTPException(
                status_code=404, 
                detail=f"No news articles found for '{request.query}'. Try a different search term or date range."
            )
        
        # 2. Process and summarize articles
        processed_articles = await summarizer.process_news_articles(articles)
        
        # 3. Generate embeddings for articles
        article_texts = [f"{article['title']} {article['summary']}" for article in processed_articles]
        embeddings = await embedding_service.get_embeddings_batch(article_texts)
        
        # 4. Store in vector database
        await vector_db.store_articles(processed_articles, embeddings)
        
        response = NewsResponse(
            articles=processed_articles,
            total_count=len(processed_articles),
            processed_at=datetime.now().isoformat()
        )
        
        logger.info(f"Successfully processed {len(processed_articles)} news articles")
        return response
        
    except Exception as e:
        logger.error(f"Error processing news request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/ask-question")
async def ask_question(request: QuestionRequest):
    """Ask questions about stored news articles"""
    try:
        logger.info(f"Processing question: {request.question}")
        
        # 1. Generate embedding for the question
        question_embedding = await embedding_service.get_embedding(request.question)
        
        # 2. Search for relevant articles
        relevant_articles = await vector_db.search_articles(question_embedding, n_results=3)
        
        if not relevant_articles:
            return {"answer": "I don't have enough information to answer your question. Please fetch some news first."}
        
        # 3. Prepare context from relevant articles
        context = ""
        for article in relevant_articles:
            context += f"Title: {article['metadata']['title']}\n"
            context += f"Content: {article['document']}\n"
            context += f"Source: {article['metadata']['source']}\n\n"
        
        # 4. Generate answer using LLM
        answer = await llm_client.answer_question(request.question, context)
        
        return {
            "answer": answer,
            "sources": [article['metadata'] for article in relevant_articles],
            "processed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error answering question: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}