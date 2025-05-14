import os
import json
import asyncio
from typing import List, Dict, Any, Tuple, Optional
import logging
from dotenv import load_dotenv
import aiohttp

from perplexipy import PerplexityClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class SonarAgent:
    """
    Agent that interfaces with the Perplexity Sonar API to generate medical advice responses.
    """
    
    def __init__(self):
        """Initialize the Sonar agent with API keys and configuration."""
        from app.core.config import settings
        self.api_key = settings.PERPLEXITY_API_KEY
        self.model = settings.PERPLEXITY_MODEL
        
        # Check if we have a valid API key
        if not self.api_key:
            logger.warning("No Perplexity API key found. Using mock responses for development.")
            self.client = None
        else:
            # Initialize the Perplexity client
            self.client = PerplexityClient(key=self.api_key)
        
        # System prompt for medical advice
        self.system_prompt = """
        You are SonarCare, an AI medical assistant designed to provide helpful, accurate, and evidence-based 
        information about health topics. 
        
        Guidelines:
        1. Provide evidence-based information from reputable medical sources when possible.
        2. Always clarify that you're providing general information, not personalized medical advice.
        3. Encourage users to consult healthcare professionals for diagnosis and treatment.
        4. Be empathetic and supportive while maintaining professionalism.
        5. For urgent or emergency symptoms, advise seeking immediate medical attention.
        6. Be transparent about limitations of AI medical information.
        7. Prioritize patient safety in all responses.
        8. Do not make definitive diagnoses or prescribe specific treatments.
        
        Remember that you are not a replacement for professional medical care.
        """
    
    async def generate_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a response using the Perplexity Sonar API.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # If we don't have a client, return mock response
        if not self.client:
            return await self._generate_mock_response(query, message_history)
        
        try:
            # Format message history for the Perplexity API
            formatted_messages = self._format_messages(query, message_history)
            
            # Create message list for PerplexiPy
            messages = []
            for msg in formatted_messages:
                messages.append(f"{msg['role']}: {msg['content']}")
            
            # Call the PerplexiPy client
            response_text = self.client.query("\n".join(messages))
            
            # Create metadata for compatibility
            metadata = {
                "model": self.model,
                "tokens": {
                    "prompt": len(query.split()),
                    "completion": len(response_text.split()),
                    "total": len(query.split()) + len(response_text.split())
                }
            }
            
            return response_text, metadata
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise
    
    def _format_messages(self, query: str, message_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format the message history into the format expected by the Perplexity API.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            List of formatted message dictionaries
        """
        formatted_messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        # Add message history (up to the last 10 messages to avoid context length issues)
        for message in message_history[-10:]:
            role = "assistant" if message["sender"] == "bot" else "user"
            formatted_messages.append({"role": role, "content": message["text"]})
        
        # Add the current query
        formatted_messages.append({"role": "user", "content": query})
        
        return formatted_messages
    
    async def _generate_mock_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a mock response for development without API keys.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Add a slight delay to simulate API call
        await asyncio.sleep(1)
        
        # Simple keyword-based mock responses
        response_text = "I'm SonarCare, your medical assistant. For real medical advice, please consult a healthcare professional."
        
        if "headache" in query.lower():
            response_text = "Headaches can have many causes including stress, dehydration, lack of sleep, or underlying conditions. For persistent or severe headaches, please consult a healthcare professional. In the meantime, rest, hydration, and over-the-counter pain relievers may help, but this is not a substitute for professional medical advice."
        
        elif "fever" in query.lower():
            response_text = "Fever is often a sign that your body is fighting an infection. For adults, a temperature above 100.4°F (38°C) is considered a fever. Rest, fluids, and fever-reducing medications may help. If the fever is high, persistent, or accompanied by other concerning symptoms, please seek medical attention immediately."
        
        elif "diabetes" in query.lower():
            response_text = "Diabetes is a chronic condition that affects how your body processes blood sugar. There are several types, with Type 1 and Type 2 being the most common. Management typically involves monitoring blood sugar, medication, diet, and exercise. Regular medical check-ups are essential. I recommend consulting with a healthcare provider for personalized advice."
        
        # Create mock metadata
        metadata = {
            "model": "mock-model",
            "tokens": {
                "prompt": 150,
                "completion": len(response_text.split()),
                "total": 150 + len(response_text.split())
            }
        }
        
        return response_text, metadata 