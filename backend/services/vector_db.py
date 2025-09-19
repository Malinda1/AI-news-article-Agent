import chromadb
import os
from typing import List, Dict
from dotenv import load_dotenv
from backend.logger import logger
from backend.utils.config import config

# Load environment variables from .env file
load_dotenv('/Users/pasindumalinda/AI_news_agent/.env')

class VectorDBService:
    def __init__(self):
        self.client = None
        self.collection = None
        self._initialized = False
    
    def _ensure_initialized(self):
        if self._initialized:
            return
            
        try:
            # Get credentials with multiple fallback options
            api_key = None
            tenant = None
            database = None
            
            # Try config first, then environment variables
            try:
                api_key = config.CHROMADB_API_KEY
                tenant = config.CHROMADB_TENANT  
                database = config.CHROMADB_DATABASE
            except:
                pass
            
            # Fallback to direct environment variable access
            if not api_key:
                api_key = os.getenv('CHROMADB_API_KEY')
            if not tenant:
                tenant = os.getenv('CHROMADB_TENANT')
            if not database:
                database = os.getenv('CHROMADB_DATABASE')
            
            # Clean up the values
            if api_key:
                api_key = api_key.strip().strip('"').strip("'")
            if tenant:
                tenant = tenant.strip().strip('"').strip("'")
            if database:
                database = database.strip().strip('"').strip("'")
            
            # Debug logging
            logger.info(f"ChromaDB API Key present: {'Yes' if api_key else 'No'}")
            logger.info(f"ChromaDB Tenant: '{tenant}'")
            logger.info(f"ChromaDB Tenant length: {len(tenant) if tenant else 'None'}")
            logger.info(f"ChromaDB Database: '{database}'")
            
            if not all([api_key, tenant, database]):
                missing = []
                if not api_key: missing.append("CHROMADB_API_KEY")
                if not tenant: missing.append("CHROMADB_TENANT") 
                if not database: missing.append("CHROMADB_DATABASE")
                raise ValueError(f"Missing ChromaDB configuration: {', '.join(missing)}")
            
            # Validate tenant format (should be UUID)
            if len(tenant) != 36 or tenant.count('-') != 4:
                logger.warning(f"Tenant ID format seems incorrect. Expected UUID format, got: '{tenant}'")
            
            # Try to connect with minimal parameters first
            logger.info("Attempting to connect to ChromaDB...")
            
            # Method 1: Try with explicit parameters
            try:
                self.client = chromadb.CloudClient(
                    api_key=api_key,
                    tenant=tenant,
                    database=database
                )
                logger.info("✅ Successfully connected with explicit parameters")
            except Exception as e:
                logger.error(f"❌ Failed with explicit parameters: {str(e)}")
                
                # Method 2: Try without tenant/database (let server determine)
                logger.info("Trying connection without explicit tenant/database...")
                try:
                    self.client = chromadb.CloudClient(api_key=api_key)
                    logger.info("✅ Connected without explicit tenant/database")
                except Exception as e2:
                    logger.error(f"❌ Also failed without tenant/database: {str(e2)}")
                    raise e  # Raise original error
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name="ai_news_articles",
                metadata={"hnsw:space": "cosine"}
            )
            
            self._initialized = True
            logger.info("🎉 Successfully initialized ChromaDB service")
            
        except Exception as e:
            logger.error(f"💥 Error connecting to ChromaDB: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            
            # Print environment for debugging (remove sensitive info)
            logger.info("Environment debug info:")
            logger.info(f"  - .env file exists: {os.path.exists('/Users/pasindumalinda/AI_news_agent/.env')}")
            
            # Show what's actually in environment
            env_keys = [k for k in os.environ.keys() if 'CHROMA' in k]
            logger.info(f"  - ChromaDB env vars found: {env_keys}")
            
            raise e
    
    async def store_articles(self, articles: List[Dict], embeddings: List[List[float]]):
        """Store articles with their embeddings in ChromaDB"""
        self._ensure_initialized()
        
        try:
            ids = []
            documents = []
            metadatas = []
            
            for i, article in enumerate(articles):
                article_id = f"article_{hash(article['link'])}_{i}"
                ids.append(article_id)
                
                # Combine title and summary for document text
                document_text = f"{article['title']} {article.get('summary', article['snippet'])}"
                documents.append(document_text)
                
                metadata = {
                    "title": article["title"],
                    "link": article["link"],
                    "source": article["source"],
                    "date": article["date"],
                    "snippet": article["snippet"]
                }
                metadatas.append(metadata)
            
            self.collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            
            logger.info(f"Successfully stored {len(articles)} articles in ChromaDB")
            
        except Exception as e:
            logger.error(f"Error storing articles in ChromaDB: {str(e)}")
            raise e
    
    async def search_articles(self, query_embedding: List[float], n_results: int = 5) -> List[Dict]:
        """Search for similar articles using vector similarity"""
        self._ensure_initialized()
        
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )
            
            articles = []
            for i in range(len(results['documents'][0])):
                article = {
                    "document": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i]
                }
                articles.append(article)
            
            logger.info(f"Retrieved {len(articles)} similar articles from ChromaDB")
            return articles
            
        except Exception as e:
            logger.error(f"Error searching articles in ChromaDB: {str(e)}")
            return []

# Global vector database instance
vector_db = VectorDBService()