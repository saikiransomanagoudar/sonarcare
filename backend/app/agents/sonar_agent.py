import os
import json
import asyncio
import re
from typing import List, Dict, Any, Tuple, Optional, AsyncGenerator
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
    Enhanced agent that interfaces with the Perplexity Sonar API to generate medical advice responses.
    Supports streaming responses and proper formatting.
    """
    
    def __init__(self):
        """Initialize the Sonar agent with API keys and configuration."""
        from app.core.config import settings
        self.api_key = settings.PERPLEXITY_API_KEY
        self.sonar = settings.PERPLEXITY_SONAR
        self.sonar_reasoning_pro = settings.PERPLEXITY_SONAR_REASONING_PRO
        self.sonar_deep_research = settings.PERPLEXITY_SONAR_DEEP_RESEARCH
        
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
        
        FORMATTING REQUIREMENTS:
        - Use clear, conversational language
        - Avoid numbered references like [1], [2], etc.
        - Do not include hyperlinks or URLs
        - Use bullet points sparingly and only for clarity
        - Write in complete, flowing sentences
        - Structure information logically with clear paragraphs
        
        Remember that you are not a replacement for professional medical care.
        """
    
    def _clean_response_formatting(self, text: str) -> str:
        """Clean up the response to remove unwanted formatting."""
        # Remove numbered references like [1], [2], etc.
        text = re.sub(r'\[\d+\]', '', text)
        
        # Remove URLs and hyperlinks
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Remove markdown links
        
        # Clean up excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        
        # Remove citation patterns
        text = re.sub(r'\(Source:.*?\)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Sources?:.*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
        
        return text.strip()
    
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
            
            # Clean the response formatting
            response_text = self._clean_response_formatting(response_text)
            
            # Create metadata for compatibility
            metadata = {
                "sonar": self.sonar,
                "sonar_reasoning_pro": self.sonar_reasoning_pro,
                "sonar_deep_research": self.sonar_deep_research,
                "tokens": {
                    "prompt": len(query.split()),
                    "completion": len(response_text.split()),
                    "total": len(query.split()) + len(response_text.split())
                },
                "formatted": True
            }
            
            return response_text, metadata
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise
    
    async def generate_streaming_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate a streaming response for real-time display.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Yields:
            Dict containing streaming data with keys: type, data, done
        """
        try:
            # For now, simulate streaming by breaking down the full response
            # In the future, this could be replaced with actual streaming API calls
            response_text, metadata = await self.generate_response(query, message_history)
            
            # Yield start signal
            yield {
                "type": "start",
                "data": "",
                "done": False,
                "metadata": metadata
            }
            
            # Split response into words for streaming effect
            words = response_text.split()
            current_text = ""
            
            for i, word in enumerate(words):
                current_text += word + " "
                
                # Yield chunk every few words or at sentence boundaries
                if i % 3 == 0 or word.endswith('.') or word.endswith('!') or word.endswith('?'):
                    yield {
                        "type": "chunk",
                        "data": current_text.strip(),
                        "done": False,
                        "metadata": {}
                    }
                    # Add small delay to simulate real streaming
                    await asyncio.sleep(0.05)
            
            # Yield final response
            yield {
                "type": "end",
                "data": response_text,
                "done": True,
                "metadata": metadata
            }
            
        except Exception as e:
            yield {
                "type": "error",
                "data": f"Error generating response: {str(e)}",
                "done": True,
                "metadata": {"error": str(e)}
            }
    
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
        
        # Add message history (up to the last 6 messages to avoid context length issues)
        for message in message_history[-6:]:
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
        await asyncio.sleep(0.5)
        
        # Simple keyword-based mock responses
        response_text = "I'm SonarCare, your medical assistant. I provide general health information to help you make informed decisions about your health. Please remember that this information is for educational purposes only and not a substitute for professional medical advice. Always consult with a healthcare professional for proper diagnosis and treatment."
        
        query_lower = query.lower()
        
        if any(word in query_lower for word in ["headache", "head pain", "migraine"]):
            response_text = """Headaches are a common health concern that can have various causes. They may result from stress, tension, dehydration, lack of sleep, eye strain, or changes in routine. Some headaches can also be triggered by certain foods, hormonal changes, or environmental factors.

For mild headaches, you might find relief through rest in a quiet, dark room, staying well-hydrated, applying a cold or warm compress to your head or neck, and practicing relaxation techniques. Over-the-counter pain relievers may also help when used as directed.

However, it's important to seek medical attention if you experience severe headaches, headaches with fever or stiff neck, sudden onset of the worst headache of your life, headaches following a head injury, or if your headache pattern changes significantly. A healthcare professional can properly evaluate your symptoms and recommend appropriate treatment."""
        
        elif any(word in query_lower for word in ["fever", "temperature", "hot"]):
            response_text = """Fever is your body's natural response to fighting infection or illness. For adults, a temperature above 100.4°F (38°C) is generally considered a fever. Common causes include viral or bacterial infections, though other conditions can also cause elevated body temperature.

When managing a fever, it's helpful to rest, drink plenty of fluids to prevent dehydration, dress in lightweight clothing, and consider fever-reducing medications like acetaminophen or ibuprofen if appropriate for you. Taking lukewarm baths or using cool compresses can also provide comfort.

You should seek immediate medical attention if you have a high fever (over 103°F/39.4°C), if the fever persists for more than three days, or if it's accompanied by severe symptoms like difficulty breathing, persistent vomiting, severe headache, chest pain, or signs of dehydration. People with compromised immune systems, chronic conditions, or those taking certain medications should consult their healthcare provider sooner."""
        
        elif any(word in query_lower for word in ["diabetes", "blood sugar", "insulin"]):
            response_text = """Diabetes is a chronic condition that affects how your body processes blood glucose (sugar). There are several types, with Type 1 and Type 2 being the most common. Type 1 diabetes typically develops when the body cannot produce insulin, while Type 2 diabetes occurs when the body doesn't use insulin effectively or doesn't produce enough.

Managing diabetes typically involves monitoring blood sugar levels, following a balanced diet, engaging in regular physical activity, and taking medications as prescribed by your healthcare provider. Many people with diabetes lead healthy, active lives with proper management and medical care.

It's essential to work closely with your healthcare team, which may include your primary care physician, an endocrinologist, a diabetes educator, and a nutritionist. They can help you develop a personalized management plan, teach you how to monitor your blood sugar, and adjust your treatment as needed. Regular check-ups are important for preventing complications and maintaining good health."""
        
        # Create mock metadata
        metadata = {
            "model": "mock-sonar",
            "tokens": {
                "prompt": len(query.split()),
                "completion": len(response_text.split()),
                "total": len(query.split()) + len(response_text.split())
            },
            "formatted": True,
            "mock": True
        }
        
        return response_text, metadata