from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.routes import router
from backend.logger import logger
from backend.utils.config import config

# Create FastAPI app
app = FastAPI(
    title="AI News Agent",
    description="An intelligent agent for fetching, summarizing, and querying AI news",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")

# Serve static files
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
async def serve_frontend():
    """Serve the frontend HTML page"""
    return FileResponse("frontend/index.html")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Global exception: {str(exc)}")
    return {"error": "Internal server error", "detail": str(exc)}

if __name__ == "__main__":
    logger.info("Starting AI News Agent server...")
    uvicorn.run(
        "backend.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
        log_level="info"
    )