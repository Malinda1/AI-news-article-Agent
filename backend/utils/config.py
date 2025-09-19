import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # API Keys
    HUGGINGFACE_API_TOKEN = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    HF_API_TOKEN = os.getenv("HF_API_TOKEN")
    SERP_API_KEY = os.getenv("SERP_API_KEY")
    CHROMADB_API_KEY = os.getenv("CHROMADB_API_KEY")
    
    # ChromaDB Config
    CHROMADB_TENANT = os.getenv("CHROMADB_TENANT")
    CHROMADB_DATABASE = os.getenv("CHROMADB_DATABASE")
    
    # Server Config
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))
    
    # Models
    LLM_MODEL = "openai/gpt-oss-120b"
    EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
    EMBEDDING_DIMENSION = 768

config = Config()