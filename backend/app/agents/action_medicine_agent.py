import logging
import json
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent
from app.agents.sonar_agent import SonarAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionMedicineAgent(BaseActionAgent):
    """
    Agent for handling medical advice related to symptoms and treatments.
    Uses a two-step approach with a single model for both search and reasoning.
    """
    
    def __init__(self):
        """Initialize the medicine agent."""
        super().__init__()
        # Initialize agent with the default model for both search and reasoning
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
    
    async def _get_medical_facts(self, condition: str) -> str:
        """Get factual information about the condition."""
        search_prompt = f"""What are common symptoms, causes, and general self-care advice for {condition}? 
Include:
- Common symptoms and signs
- Potential causes
- General self-care recommendations
- When to see a doctor
- Common treatments doctors might recommend

Focus on factual, evidence-based information from reputable medical sources."""
        
        facts_response, _ = await self._generate_response(search_prompt, model=self.model)
        return facts_response
    
    async def _generate_safe_advice(self, query: str, medical_facts: str) -> Tuple[str, Dict[str, Any]]:
        """Generate safe medical advice based on the facts and query."""
        advice_prompt = f"""User query: "{query}"

Context from medical research:
{medical_facts}

Based on this information, provide helpful general information about the mentioned health concern. Your response should:
1. Acknowledge the user's concern with empathy
2. Provide general, non-diagnostic information about the condition
3. Include general self-care suggestions that might help manage symptoms
4. Emphasize the importance of consulting a healthcare professional for diagnosis and treatment
5. Note that this is general information, not personalized medical advice
6. Be cautious and avoid making definitive claims about what the user personally has

Response format: Provide a helpful, conversational response that a medical chatbot would give."""
        
        return await self._generate_response(advice_prompt, model=self.model)
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Process a medical query using the two-step approach.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        try:
            # Step 1: Extract the main medical condition
            condition = await self._extract_condition(query)
            logger.info(f"Extracted condition: {condition}")
            
            # Step 2: Get factual information about the condition
            medical_facts = await self._get_medical_facts(condition)
            
            # Step 3: Generate safe advice based on the facts
            response, metadata = await self._generate_safe_advice(query, medical_facts)
            
            # Add processing info to metadata
            metadata["condition"] = condition
            metadata["two_step_process"] = True
            metadata["model_used"] = self.model
            
            return response, metadata
            
        except Exception as e:
            logger.error(f"Error in medicine agent: {str(e)}")
            # Fallback to basic response if the advanced flow fails
            return await super().process(query, message_history) 