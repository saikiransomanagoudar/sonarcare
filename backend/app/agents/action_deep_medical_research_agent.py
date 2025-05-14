import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionDeepMedicalResearchAgent(BaseActionAgent):
    """
    Agent for providing comprehensive, expert-level research information on medical topics.
    Uses Sonar Deep Research for generating in-depth responses.
    """
    
    def __init__(self):
        """Initialize the deep medical research agent."""
        super().__init__()
        # Use Sonar for deep research
        self.model = "sonar-large-online"  # Using the most powerful model available
    
    async def _extract_research_topic(self, query: str) -> str:
        """Extract the primary research topic from the query."""
        prompt = f"""Extract the precise medical research topic from the following query.
If the query mentions multiple topics, focus on the main one that requires in-depth research.

User query: "{query}"

Response format: Only output the extracted research topic - nothing else."""
        
        topic_response, _ = await self._generate_response(prompt)
        return topic_response.strip()
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Generate comprehensive research information on a medical topic.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Extract the research topic
        topic = await self._extract_research_topic(query)
        logger.info(f"Deep research topic: {topic}")
        
        # Build a comprehensive research prompt
        research_prompt = f"""Generate a comprehensive, expert-level research analysis on {topic}.

Your research should include:
1. Current scientific understanding and consensus on the topic
2. Recent advancements or breakthroughs (within the last 1-3 years)
3. Evidence-based treatments or interventions
4. Ongoing clinical trials or promising areas of research
5. Expert perspectives and any controversies in the field
6. Statistical data and epidemiological information, if relevant
7. References to specific research papers or medical guidelines

Structure this as an accessible yet thorough summary that balances scientific accuracy with understandable language. Include specific details where appropriate (medication names, treatment approaches, scientific mechanisms).

Remember this is for informational purposes only and not medical advice. Note that research is continually evolving and the user should consult healthcare professionals for personalized guidance."""
        
        # Generate the deep research response
        response, metadata = await self._generate_response(research_prompt, model=self.model)
        
        # Add research topic to metadata
        metadata["research_topic"] = topic
        metadata["research_depth"] = "comprehensive"
        
        return response, metadata 