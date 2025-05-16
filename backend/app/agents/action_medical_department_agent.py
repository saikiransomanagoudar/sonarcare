import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionMedicalDepartmentAgent(BaseActionAgent):
    """
    Agent for helping users determine which medical department or specialist they should consult.
    Uses Sonar for search-grounded responses about medical specialties.
    """
    
    def __init__(self):
        """Initialize the medical department agent."""
        super().__init__()
        # Use default model from config
        self.model = settings.PERPLEXITY_SONAR
    
    async def _extract_condition(self, query: str) -> str:
        """Extract the primary medical condition or symptom from the query."""
        prompt = f"""Extract the primary medical condition, symptom, or health concern from the following query.
If multiple symptoms or conditions are mentioned, focus on the main one.
If no specific condition is mentioned, extract the general health topic.

User query: "{query}"

Response format: Only output the extracted condition or symptom - nothing else."""
        
        condition_response, _ = await self._generate_response(prompt)
        return condition_response.strip()
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Determine which medical department or specialist is appropriate for a condition.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Extract the condition
        condition = await self._extract_condition(query)
        
        # Build the department search prompt
        department_prompt = f"""What medical department or specialist typically treats {condition}?

Provide information on:
1. The primary medical specialty or department that handles this condition
2. Any subspecialties that might be relevant
3. The type of doctor to consult initially (e.g., general practitioner, specialist)
4. When to consider emergency care versus scheduled appointments
5. What to expect during an initial consultation

Format your response as helpful advice from a medical assistant, emphasizing that this is general information and the appropriate specialist may vary based on individual circumstances and healthcare systems in different countries.

Be clear about common medical practice while acknowledging that referral processes may differ between healthcare systems."""
        
        # Generate the department recommendation
        response, metadata = await self._generate_response(department_prompt, model=self.model)
        
        # Add condition to metadata
        metadata["condition"] = condition
        
        return response, metadata 