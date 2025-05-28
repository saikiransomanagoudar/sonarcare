import logging
from typing import List, Dict, Any, Tuple

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

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
        # Use default model from config
        self.model = settings.PERPLEXITY_SONAR
        
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
            prompt = """Generate a comprehensive introduction for SonarCare, an advanced medical advice chatbot with research and source verification capabilities. 
The introduction should:

**WARM WELCOME:**
- Provide an enthusiastic, empathetic welcome
- Introduce SonarCare as an advanced AI medical assistant with research capabilities
- Convey expertise while maintaining approachability

**RESEARCH & SOURCE VERIFICATION CAPABILITIES:**
Explain that SonarCare provides:
- Comprehensive medical information based on established medical knowledge
- When needed, real-time medical research using current, authoritative sources
- Source-verified information with numbered citations and reference links when internet research is performed
- Grounded information from peer-reviewed medical literature when searching online
- Ability to search and cite the latest medical research and clinical guidelines when current information is needed

**COMPREHENSIVE MEDICAL CAPABILITIES:**
Explain that SonarCare provides detailed information about:
- Medical information about symptoms, conditions, and treatments
- Comprehensive explanations of causes, risk factors, and prevention strategies
- Multiple treatment approaches including medical, lifestyle, and self-care options
- Guidance on when to seek different levels of medical care
- Information about medical specialties and which doctors to consult
- Hospital and healthcare facility recommendations
- Preparation guidance for medical appointments and procedures
- Deep medical research information and latest developments when internet research is performed
- Healthcare navigation and system guidance

**ENHANCED RESPONSE STRUCTURE:**
Mention that responses include:
- Detailed background and medical context
- Comprehensive symptom and treatment information
- Practical, actionable recommendations
- Clear guidance on medical care timing
- Educational content with clear explanations

**TRANSPARENCY AND VERIFICATION:**
- When internet research is performed for current information, all medical information includes verifiable source citations
- Users can verify information through provided reference links when sources are included
- Sources prioritize medical journals, government agencies, and professional organizations
- Research transparency with clear attribution when internet search is used
- Clear indication when response is based on established medical knowledge vs. internet research

**SAFETY AND LIMITATIONS:**
- Clearly state this provides general health information, not diagnosis
- Emphasize importance of consulting healthcare professionals for personalized care
- Note that information supports informed decision-making
- Explain this enhances but doesn't replace professional medical care
- All information should be verified with healthcare providers

**INVITATION TO ENGAGE:**
- Encourage specific health-related questions
- Mention ability to provide detailed responses
- Express readiness to help with various health topics using medical knowledge
- Convey commitment to providing maximum value
- Note that for current research or facility-specific information, internet search with sources will be provided

Make it comprehensive yet approachable, informative yet reassuring. Emphasize the conditional source verification capabilities while maintaining appropriate medical boundaries."""
        
        else:
            # For returning users, provide a focused greeting
            prompt = """Generate a warm, brief greeting for a returning user of SonarCare medical assistant.
The greeting should:
- Acknowledge their return warmly
- Briefly remind them of comprehensive medical information capabilities
- Ask what specific health topic they'd like detailed information about
- Maintain supportive, professional medical assistant tone
- Be concise but convey readiness to provide thorough assistance

Response format: Just the greeting text, 2-3 sentences maximum."""
        
        # Generate the greeting
        response, metadata = await self._generate_response(prompt)
        
        # Add greeting type to metadata
        metadata["greeting_type"] = "first_time" if is_first_message else "returning"
        
        return response, metadata 