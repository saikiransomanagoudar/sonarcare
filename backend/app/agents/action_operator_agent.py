import logging
from typing import List, Dict, Any, Tuple, Optional

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionOperatorAgent(BaseActionAgent):
    """
    Supervisor agent that detects user intent and routes to the appropriate specialized agent.
    Uses Sonar Reasoning for intent classification.
    """
    
    INTENTS = [
        "greeting",
        "symptom_inquiry",
        "treatment_advice",
        "hospital_search",
        "department_inquiry",
        "deep_medical_inquiry",
        "unbiased_factual_request",
        "unknown"
    ]
    
    def __init__(self):
        """Initialize the operator agent."""
        super().__init__()
        # Use default model from config
        self.model = settings.PERPLEXITY_MODEL
        
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Detect the intent of the user query.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (intent, metadata)
        """
        # Build the intent classification prompt
        prompt = f"""Classify the user's medical query intent into exactly one of these categories:
- greeting: Simple greetings, introductions, or small talk
- symptom_inquiry: Questions about symptoms, their causes, or what they might indicate
- treatment_advice: Questions about treatments, medications, or self-care
- hospital_search: Seeking hospitals, clinics, or medical facilities
- department_inquiry: Questions about which medical department or specialist to consult
- deep_medical_inquiry: Requests for in-depth research or detailed medical information
- unbiased_factual_request: Requests for unbiased information on controversial medical topics
- unknown: Queries that don't fit any other category

User query: '{query}'

Response format: Return only the intent category name, nothing else.
"""
        
        # Generate the intent classification
        intent_response, metadata = await self._generate_response(prompt)
        
        # Clean up and validate the response
        intent = intent_response.strip().lower()
        if intent not in self.INTENTS:
            intent = "unknown"
            logger.warning(f"Invalid intent detected: {intent_response}. Defaulting to 'unknown'.")
        
        # Add intent to metadata
        metadata["intent"] = intent
        
        return intent, metadata 