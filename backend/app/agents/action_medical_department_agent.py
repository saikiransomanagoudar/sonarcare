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
        department_prompt = f"""Provide comprehensive information about medical specialties and departments for {condition}.

**PRIMARY MEDICAL SPECIALTIES:**
Identify and explain the main medical specialty or department that typically treats {condition}, including:
- Primary specialty name and focus area
- Sub-specialties within this field that may be relevant
- Training and expertise of specialists in this field
- Common procedures and treatments they perform
- Typical patient populations they serve

**HEALTHCARE PROVIDER HIERARCHY:**
Explain the appropriate healthcare pathway:
- When to start with a primary care physician vs. specialist
- Referral processes and requirements
- How specialists work with primary care teams
- Coordination between different specialties when multiple are involved
- Role of mid-level providers (nurse practitioners, physician assistants)

**DETAILED SPECIALTY INFORMATION:**
For each relevant medical specialty, provide:
- Full specialty name and common abbreviations
- Specific conditions and symptoms they treat
- Training requirements and board certifications
- Sub-specialties and fellowship areas
- Typical diagnostic tools and procedures they use
- Treatment approaches and philosophies
- When referrals to this specialty are indicated

**CONSULTATION PROCESS:**
Provide detailed information about:
- How to obtain referrals and appointments
- What to expect during initial consultations
- Questions specialists typically ask
- Examinations and tests commonly performed
- Timeline for diagnosis and treatment planning
- Follow-up care and ongoing management approaches

**PREPARATION FOR APPOINTMENTS:**
Include comprehensive guidance on:
- Medical history information to compile
- Symptoms to track and document
- Questions to prepare for the specialist
- Documents and test results to bring
- Insurance considerations and pre-authorization
- What family members or caregivers should know

**MULTIDISCIPLINARY CARE:**
Explain when multiple specialties may be involved:
- Conditions requiring team-based care
- How different specialists coordinate treatment
- Role of case managers and care coordinators
- Integration with other healthcare services (pharmacy, physical therapy, etc.)
- Communication between providers and patient advocacy

**URGENT VS. ROUTINE CARE:**
Provide clear guidance on:
- Conditions requiring immediate specialist attention
- Emergency vs. urgent vs. routine specialist care
- How to access urgent specialty consultations
- When emergency department referral is appropriate
- Triage processes and priority systems

**SECOND OPINIONS AND ALTERNATIVES:**
Include information about:
- When to consider second opinions
- How to obtain additional specialist perspectives
- Alternative treatment approaches to discuss
- Integrative and complementary medicine options
- Patient rights regarding treatment choices

**HEALTHCARE SYSTEM NAVIGATION:**
Provide practical advice on:
- Understanding different healthcare settings (academic vs. community)
- Finding specialists within insurance networks
- Researching physician credentials and experience
- Patient portal systems and communication
- Advocating for appropriate and timely care

**GLOBAL HEALTHCARE CONSIDERATIONS:**
Acknowledge that:
- Healthcare systems vary by country and region
- Referral processes may differ between healthcare systems
- Insurance and payment systems vary globally
- Cultural considerations in specialist care
- Telemedicine and remote consultation options

Format the response to be comprehensive yet organized, providing maximum value for healthcare decision-making while acknowledging regional variations in healthcare delivery."""
        
        # Generate the department recommendation
        response, metadata = await self._generate_response(department_prompt, model=self.model)
        
        # Add condition to metadata
        metadata["condition"] = condition
        
        return response, metadata 