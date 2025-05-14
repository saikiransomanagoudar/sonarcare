import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionFactualUnbiasedAgent(BaseActionAgent):
    """
    Agent for providing unbiased, factual information on potentially controversial medical topics.
    Uses a specialized model for balanced, evidence-based responses.
    """
    
    def __init__(self):
        """Initialize the unbiased factual agent."""
        super().__init__()
        # Use a balanced model with strong factual capabilities
        self.model = "sonar-large-online"
    
    async def _extract_controversial_topic(self, query: str) -> str:
        """Extract the potentially controversial medical topic from the query."""
        prompt = f"""Extract the primary medical topic from the following query, particularly noting if it's a topic that might be controversial or have differing medical perspectives.

User query: "{query}"

Response format: Only output the extracted medical topic - nothing else."""
        
        topic_response, _ = await self._generate_response(prompt)
        return topic_response.strip()
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Generate an unbiased, factual overview of a potentially controversial medical topic.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Extract the potentially controversial topic
        topic = await self._extract_controversial_topic(query)
        logger.info(f"Unbiased research topic: {topic}")
        
        # Build an unbiased research prompt
        unbiased_prompt = f"""Provide a balanced, evidence-based overview of {topic}.

Your analysis should:
1. Present factual information about the topic from a neutral perspective
2. Include multiple perspectives from mainstream medical science
3. Clearly distinguish between scientific consensus and areas of ongoing debate
4. Present relevant historical context and efficacy data where available
5. Acknowledge limitations in current research
6. Avoid taking a stance on controversial aspects, instead presenting the evidence from all sides
7. Include relevant statistics and cite known outcomes where appropriate

Present the information in a straightforward, neutral tone that respects the user's intelligence and desire for unbiased information. Avoid euphemisms or overly cautious language that obscures facts, while maintaining appropriate medical context.

Conclude with a balanced summary of the current state of evidence."""
        
        # Generate the unbiased response
        response, metadata = await self._generate_response(unbiased_prompt, model=self.model)
        
        # Add topic to metadata
        metadata["topic"] = topic
        metadata["response_type"] = "unbiased_factual"
        
        return response, metadata 