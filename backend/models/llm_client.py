import os
from huggingface_hub import InferenceClient
from backend.logger import logger
from backend.utils.config import config

class LLMClient:
    def __init__(self):
        self.client = InferenceClient(
            api_key=config.HUGGINGFACE_API_TOKEN,
        )
        self.model = config.LLM_MODEL
        logger.info(f"Initialized LLM client with model: {self.model}")
    
    async def generate_summary(self, article_text: str, title: str) -> str:
        """Generate a summary for a news article"""
        try:
            prompt = f"""
            Please provide a comprehensive summary of the following AI news article:
            
            Title: {title}
            Content: {article_text}
            
            The summary should include:
            1. Main topic and key developments
            2. Important companies/people mentioned
            3. Potential impact on AI industry
            4. Key technical details (if any)
            
            Keep the summary concise but informative (150-200 words).
            """
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            summary = completion.choices[0].message.content
            logger.info(f"Generated summary for article: {title[:50]}...")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return "Summary generation failed due to an error."
    
    async def answer_question(self, question: str, context: str) -> str:
        """Answer questions based on stored news context with improved date awareness"""
        try:
            prompt = f"""
            You are an AI news assistant. Based on the following AI news context, please answer the question accurately.
            
            Context (Recent AI News):
            {context}
            
            Question: {question}
            
            Instructions:
            1. Answer based ONLY on the information provided in the context
            2. If the question asks about a specific date, focus on news from that timeframe
            3. If no relevant information is available, clearly state that
            4. Be specific about dates, companies, and technical details when mentioned
            5. Provide a clear, concise, and informative answer
            
            Answer:
            """
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful AI news assistant that provides accurate information based on provided context. Pay special attention to dates and temporal references in both questions and context."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            answer = completion.choices[0].message.content
            logger.info(f"Answered question: {question[:50]}...")
            return answer
            
        except Exception as e:
            logger.error(f"Error answering question: {str(e)}")
            return "I couldn't answer the question due to an error. Please try again."
    
    async def extract_date_intent(self, query: str) -> dict:
        """Use LLM to extract date-related intent from natural language queries"""
        try:
            prompt = f"""
            Analyze the following query and extract any date-related information:
            
            Query: "{query}"
            
            Please identify:
            1. Any specific dates mentioned (e.g., "August 12", "12th August", "2024-08-12")
            2. Relative time references (e.g., "yesterday", "last week", "3 days ago")
            3. The main topic without the date reference
            
            Respond in this format:
            - Specific date: [date if found, or "none"]
            - Relative time: [relative time if found, or "none"] 
            - Clean topic: [main topic without date references]
            - Days back: [number of days to search back, or 7 as default]
            """
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=350,
                temperature=0.1
            )
            
            response = completion.choices[0].message.content
            logger.info(f"Extracted date intent from query: {query[:50]}...")
            
            # Parse the LLM response (this is a simple implementation)
            # In a production system, you might want more robust parsing
            return {"raw_analysis": response}
            
        except Exception as e:
            logger.error(f"Error extracting date intent: {str(e)}")
            return {"raw_analysis": "Failed to analyze date intent"}

# Global LLM client instance
llm_client = LLMClient()