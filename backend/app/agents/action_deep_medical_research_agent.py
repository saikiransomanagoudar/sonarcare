import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionDeepMedicalResearchAgent(BaseActionAgent):
    """
    Agent for providing comprehensive, expert-level research information on medical topics.
    Uses Sonar for generating in-depth responses.
    """
    
    def __init__(self):
        """Initialize the deep medical research agent."""
        super().__init__()
        # Use default model from config
        self.model = settings.PERPLEXITY_SONAR_DEEP_RESEARCH
    
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
        research_prompt = f"""Generate a comprehensive, expert-level research analysis on {topic} that provides maximum medical information and value. For cutting-edge research and current information, search the internet and provide source citations with actual URLs.

**CURRENT SCIENTIFIC UNDERSTANDING:**
- Latest medical consensus and evidence-based understanding
- Fundamental pathophysiology and biological mechanisms
- Recent paradigm shifts or evolving concepts in the field
- Molecular and cellular basis of the condition/topic
- Genetic and epigenetic factors involved
- Biomarkers and diagnostic innovations

**CUTTING-EDGE RESEARCH AND BREAKTHROUGHS:**
- Recent breakthrough studies and landmark research (last 1-3 years)
- Emerging therapeutic targets and novel treatment approaches
- Innovative diagnostic technologies and precision medicine advances
- Gene therapy, immunotherapy, and regenerative medicine developments
- Artificial intelligence and digital health applications
- Nanotechnology and targeted drug delivery systems

**COMPREHENSIVE TREATMENT LANDSCAPE:**
- Evidence hierarchy: proven treatments vs. experimental approaches
- Mechanism of action for different therapeutic classes
- Comparative effectiveness research and treatment algorithms
- Personalized medicine and biomarker-guided therapy
- Combination therapies and synergistic approaches
- Treatment resistance mechanisms and overcoming strategies

**ACTIVE CLINICAL RESEARCH:**
- Current Phase II and Phase III clinical trials
- Promising investigational drugs and devices
- Novel therapeutic targets under investigation
- Recruitment criteria and trial locations for patient reference
- Expected timeline for new treatment approvals
- Breakthrough therapy designations and fast-track processes

**EXPERT PERSPECTIVES AND CONTROVERSIES:**
- Leading research institutions and key opinion leaders
- Ongoing scientific debates and areas of uncertainty
- Conflicting evidence and how experts interpret differences
- International variations in treatment approaches
- Health economic considerations and cost-effectiveness
- Ethical considerations in treatment and research

**STATISTICAL AND EPIDEMIOLOGICAL DATA:**
- Prevalence and incidence rates across different populations
- Risk stratification and prognostic factors
- Natural history and disease progression patterns
- Mortality and morbidity statistics
- Health disparities and access considerations
- Global burden of disease and regional variations

**FUTURE DIRECTIONS AND EMERGING TRENDS:**
- Research priorities and funding focus areas
- Technological innovations on the horizon
- Potential game-changing discoveries in development
- Anticipated regulatory approvals and timeline
- Integration with digital health and telemedicine
- Prevention strategies and population health approaches

**PRACTICAL CLINICAL APPLICATIONS:**
- How research findings translate to clinical practice
- Implementation challenges and real-world effectiveness
- Healthcare system implications and resource requirements
- Training and education needs for healthcare providers
- Patient advocacy and support resources
- Quality metrics and outcome measurements

**RESEARCH METHODOLOGY AND EVIDENCE QUALITY:**
- Types of studies available (RCTs, meta-analyses, real-world evidence)
- Quality assessment of available evidence
- Limitations and gaps in current research
- Sources of bias and how they're addressed
- Reproducibility and validation of findings
- International collaboration and data sharing initiatives

**PATIENT AND HEALTHCARE IMPLICATIONS:**
- How research advances benefit patients currently
- Timeline for research to reach clinical practice
- Patient selection criteria for new treatments
- Monitoring and safety considerations
- Healthcare provider education and training needs
- Health system adaptations required for new approaches

**SOURCE REQUIREMENTS FOR CURRENT RESEARCH:**
When you search the internet for current information (especially for cutting-edge research, clinical trials, recent studies):
- Use numbered citations [1], [2], etc. throughout your response
- Include actual URLs from your search results
- Format URLs as clickable markdown links: [URL text](URL) for better user experience
- Prioritize: recent peer-reviewed journals, government health agencies, clinical trial databases, research institutions
- Create a "**Verified Sources and References**" section with all URLs and publication details
- Clearly state that the response includes recent internet research
- Include specific URLs, DOIs, publication titles, author names, and dates

For established medical knowledge not requiring current search:
- Provide comprehensive information based on established medical literature
- Do not include a sources section for general medical knowledge
- Note: "This analysis combines established medical knowledge with current research where internet search was performed"

Include specific examples, mention key research developments, and provide context for how this research impacts current medical practice. Balance scientific rigor with accessibility, ensuring the information is valuable for both healthcare professionals and informed patients.

Remember to note that research is continually evolving, findings require validation, and patients should discuss cutting-edge options with their healthcare teams for personalized guidance."""
        
        # Generate the deep research response
        response, metadata = await self._generate_response(research_prompt, model=self.model)
        
        # Add research topic to metadata
        metadata["research_topic"] = topic
        metadata["research_depth"] = "comprehensive"
        
        return response, metadata 