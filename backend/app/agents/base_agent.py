import os
import logging
from typing import List, Dict, Any, Tuple, Optional
from abc import ABC, abstractmethod

from app.agents.sonar_agent import SonarAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BaseActionAgent(ABC):
    """
    Base class for all action agents in the SonarCare system.
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