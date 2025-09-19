import os
from huggingface_hub import InferenceClient
from backend.logger import logger
from backend.utils.config import config
from typing import List

class EmbeddingService:
    def __init__(self):
        self.client = InferenceClient(
            api_key=config.HF_API_TOKEN,
        )
        self.model = config.EMBEDDING_MODEL
        logger.info(f"Initialized embedding service with model: {self.model}")
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        try:
            result = self.client.feature_extraction(
                text,
                model=self.model,
            )
            
            logger.info(f"Generated embedding for text: {text[:50]}...")
            return result
            
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise e
    
    async def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        embeddings = []
        for text in texts:
            try:
                embedding = await self.get_embedding(text)
                embeddings.append(embedding)
            except Exception as e:
                logger.error(f"Failed to get embedding for text: {text[:50]}...")
                embeddings.append([0.0] * config.EMBEDDING_DIMENSION)
        
        return embeddings

# Global embedding service instance
embedding_service = EmbeddingService()