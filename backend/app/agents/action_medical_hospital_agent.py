import logging
import re
from typing import List, Dict, Any, Tuple, Optional

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionMedicalHospitalAgent(BaseActionAgent):
    """
    Agent for finding hospitals and medical facilities.
    Uses Sonar to get information on hospitals, clinics, and specialists.
    """
    
    def __init__(self):
        """Initialize the hospital search agent."""
        super().__init__()
        # Use default model from config
        self.model = settings.PERPLEXITY_SONAR
    
    async def _extract_location_and_specialty(self, query: str) -> Dict[str, str]:
        """Extract location and medical specialty from the query."""
        extraction_prompt = f"""Extract the location and medical specialty from the following query.

User query: "{query}"

Use the format:
Location: [extracted location, or "unspecified" if none]
Specialty: [extracted medical specialty or condition, or "general" if none]"""
        
        extraction_response, _ = await self._generate_response(extraction_prompt)
        
        # Parse the response
        location = "unspecified"
        specialty = "general"
        
        location_match = re.search(r"Location:\s*(.+)", extraction_response)
        if location_match:
            location = location_match.group(1).strip()
            if location.lower() == "unspecified":
                location = "unspecified"
                
        specialty_match = re.search(r"Specialty:\s*(.+)", extraction_response)
        if specialty_match:
            specialty = specialty_match.group(1).strip()
            if specialty.lower() == "general":
                specialty = "general"
        
        return {
            "location": location,
            "specialty": specialty
        }
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Search for hospitals or medical facilities based on the query.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Extract location and specialty
        extracted = await self._extract_location_and_specialty(query)
        location = extracted["location"]
        specialty = extracted["specialty"]
        
        # Build the search prompt
        search_prompt = f"""List reputable hospitals or medical facilities"""
        
        if location != "unspecified":
            search_prompt += f" in or near {location}"
        
        if specialty != "general":
            search_prompt += f" that specialize in {specialty}"
        
        search_prompt += """.

For each hospital or facility, include:
1. Full name of the hospital/clinic
2. General location/address
3. Whether they specialize in the requested medical field
4. Brief note about reputation or quality of care, if available
5. Contact information, if available

List at least 3-5 options if possible. If you don't have specific information about facilities at the exact location, mention this and provide general advice about finding quality medical care for this specialty.

Important: Note that this information may not be completely up-to-date and the user should verify by checking the hospital's website or calling directly."""
        
        # Generate the hospital search results
        response, metadata = await self._generate_response(search_prompt, model=self.model)
        
        # Add extracted data to metadata
        metadata["location"] = location
        metadata["specialty"] = specialty
        
        return response, metadata 