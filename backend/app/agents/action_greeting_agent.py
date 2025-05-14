import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionGreetingAgent(BaseActionAgent):
    """
    Agent for handling greetings and introductions.
    Uses a lightweight model as the task is simple.
    """
    
    def __init__(self):
        """Initialize the greeting agent."""
        super().__init__()
        # Use a lightweight model for simple greetings
        self.model = "sonar-small-online"
        
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a friendly greeting response.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Build the greeting prompt
        prompt = """Generate a friendly, empathetic greeting for a medical advice chatbot. 
The greeting should:
- Be warm and welcoming
- Briefly introduce the chatbot as SonarCare, a medical assistant
- Mention that it provides general health information, not medical diagnosis
- Encourage the user to ask health-related questions
- Be concise (2-3 sentences maximum)

Response format: Just the greeting text, no additional explanations.
"""
        
        # Check if this is the first message in the conversation
        is_first_message = len(message_history) <= 1
        
        if is_first_message:
            # For the first message, provide a more comprehensive introduction
            prompt = """Generate a comprehensive introduction for a medical advice chatbot named SonarCare. 
The introduction should:
- Warmly welcome the user
- Explain that SonarCare provides general health information, not medical diagnosis
- Emphasize the importance of consulting healthcare professionals for medical advice
- Mention it can help with general symptom information, treatment options, and finding appropriate medical departments
- Invite the user to ask health-related questions
- Be friendly and reassuring

Response format: Just the introduction text, no additional explanations.
"""
        
        # Generate the greeting
        response, metadata = await self._generate_response(prompt)
        
        # Add greeting type to metadata
        metadata["greeting_type"] = "first_time" if is_first_message else "returning"
        
        return response, metadata 