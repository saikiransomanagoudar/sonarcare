import os
import logging
from typing import List, Dict, Any, Tuple, Optional, AsyncGenerator
from abc import ABC, abstractmethod

from app.agents.sonar_agent import SonarAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BaseActionAgent(ABC):
    """
    Enhanced base class for all action agents in the SonarCare system.
    Supports both regular and streaming responses.
    """
    
    def __init__(self):
        """Initialize the base action agent."""
        # By default, use the standard sonar agent
        self.agent = SonarAgent()
        
    @abstractmethod
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Process a user query and generate a response.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        pass
    
    async def generate_streaming_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate a streaming response. Base implementation uses the SonarAgent's streaming capability.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Yields:
            Dict containing streaming data with keys: type, data, done, metadata
        """
        # Check if the agent supports streaming
        if hasattr(self.agent, 'generate_streaming_response'):
            async for chunk in self.agent.generate_streaming_response(query, message_history):
                yield chunk
        else:
            # Fallback: generate full response and simulate streaming
            response, metadata = await self.process(query, message_history)
            
            yield {
                "type": "start",
                "data": "",
                "done": False,
                "metadata": metadata
            }
            
            # Simulate streaming by breaking response into chunks
            import asyncio
            words = response.split()
            current_text = ""
            
            for i, word in enumerate(words):
                current_text += word + " "
                
                # Yield chunk every few words or at sentence boundaries
                if i % 4 == 0 or word.endswith('.') or word.endswith('!') or word.endswith('?'):
                    yield {
                        "type": "chunk",
                        "data": current_text.strip(),
                        "done": False
                    }
                    await asyncio.sleep(0.04)  # Small delay for streaming effect
            
            yield {
                "type": "end",
                "data": response,
                "done": True,
                "metadata": metadata
            }
    
    async def _generate_response(self, prompt: str, model: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a response using the agent's model.
        
        Args:
            prompt: The prompt to send to the model
            model: Optional model override
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # For custom model handling in subclasses
        temp_history = [{"sender": "user", "text": prompt}]
        return await self.agent.generate_response(prompt, temp_history)