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
        Search for hospitals or medical facilities based on the query with comprehensive source citations.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Extract location and specialty from the query
        extracted = await self._extract_location_and_specialty(query)
        location = extracted["location"]
        specialty = extracted["specialty"]
        
        # Get comprehensive hospital information with sources
        facility_info = await self._get_detailed_hospital_information(location, specialty)
        
        # Generate comprehensive guidance with source citations
        response, metadata = await self._generate_hospital_guidance(query, facility_info)
        
        # Add extracted data to metadata
        metadata["location"] = location
        metadata["specialty"] = specialty
        metadata["research_type"] = "hospital_and_facility_search"
        metadata["sources_included"] = True
        metadata["grounded"] = True
        
        return response, metadata

    async def _get_detailed_hospital_information(self, location: str, specialty: str = "") -> str:
        """Get comprehensive information about hospitals and medical facilities with sources."""
        search_prompt = f"""Provide comprehensive information about hospitals and medical facilities in {location}{f' specializing in {specialty}' if specialty else ''}. For current facility information, quality ratings, and specific details, search the internet and include verified sources with actual URLs.

**FACILITY IDENTIFICATION AND BASIC INFORMATION:**
- Names and locations of major hospitals and medical centers
- Types of facilities (academic medical centers, community hospitals, specialty clinics, urgent care, etc.)
- Hospital systems and healthcare networks in the area
- Ownership structure (public, private, non-profit, for-profit)
- Bed capacity and facility size classifications

**MEDICAL SPECIALTIES AND SERVICES:**
- Comprehensive list of medical departments and specialties available
- Centers of excellence and specialized programs
- Emergency services and trauma center designations
- Surgical capabilities and advanced procedures offered
- Diagnostic imaging and laboratory services
- Rehabilitation and long-term care services

**QUALITY INDICATORS AND ACCREDITATION:**
- Hospital quality ratings and safety scores
- Accreditation status (Joint Commission, AAAHC, etc.)
- Patient satisfaction scores and experience ratings
- Clinical outcomes and performance metrics
- Infection rates and safety indicators
- Awards and recognitions received

**EMERGENCY AND URGENT CARE GUIDANCE:**
- Emergency department locations and contact information
- Trauma center levels and capabilities
- Urgent care centers and walk-in clinics
- When to choose emergency vs. urgent vs. routine care
- Expected wait times and triage processes
- Pediatric emergency services availability

**ACCESSIBILITY AND PATIENT SERVICES:**
- Insurance acceptance and billing information
- Transportation options and parking availability
- Language services and interpreter availability
- Disability accommodations and accessibility features
- Visiting hours and patient support services
- Social services and case management

**FINANCIAL CONSIDERATIONS:**
- Estimated costs for common procedures and services
- Financial assistance programs and charity care
- Payment options and billing practices
- Insurance network participation
- Out-of-network considerations and surprise billing protections
- Resources for financial planning and assistance

**GEOGRAPHIC AND LOGISTICAL INFORMATION:**
- Detailed locations and directions
- Public transportation accessibility
- Parking availability and costs
- Nearby hotels for out-of-town patients
- Local resources and amenities
- Campus maps and navigation assistance

**PHYSICIAN AND STAFF INFORMATION:**
- How to find and verify physician credentials
- Residency and fellowship training programs
- Nursing staff qualifications and ratios
- Multidisciplinary care team composition
- Academic affiliations and teaching status
- Research programs and clinical trials

**APPOINTMENT SCHEDULING AND ACCESS:**
- How to schedule appointments and consultations
- Typical wait times for different services
- Expedited scheduling for urgent conditions
- Telemedicine and virtual care options
- Second opinion services and referral processes
- International patient services if applicable

**PATIENT PREPARATION AND WHAT TO EXPECT:**
- Pre-admission requirements and preparation
- What to bring for appointments and procedures
- Hospital policies and procedures
- Patient rights and responsibilities
- Discharge planning and follow-up care
- Support services for patients and families

**GLOBAL HEALTHCARE CONTEXT:**
- How local facilities compare to national standards
- International accreditation and medical tourism considerations
- Cross-border healthcare options if applicable
- Cultural competency and international patient services
- Quality comparisons with other regions or countries

**SOURCE REQUIREMENTS FOR CURRENT FACILITY INFORMATION:**
When you search the internet for current facility information, quality ratings, or specific details:
- Use numbered citations [1], [2], etc. throughout your response
- Include actual URLs from hospital websites, quality databases, and verification sources
- Format URLs as clickable markdown links: [URL text](URL) for better user experience
- Prioritize: official hospital websites, government health databases, accreditation organizations, healthcare quality reporting sites
- Create a "**Verified Sources and References**" section with all URLs, contact information, and verification dates
- Clearly state that the response includes current internet research
- Include specific facility websites, phone numbers, and direct links to quality reports

For general healthcare guidance not requiring current search:
- Provide comprehensive information based on established healthcare knowledge
- Do not include a sources section for general medical guidance
- Note: "For current facility information, quality ratings, and contact details, please verify directly with healthcare facilities"

Focus on providing accurate, current information that helps users make informed decisions about healthcare facilities while noting the importance of verifying information directly with healthcare providers."""
        
        facility_info, _ = await self._generate_response(search_prompt, model=self.model)
        return facility_info
    
    async def _generate_hospital_guidance(self, query: str, facility_info: str) -> Tuple[str, Dict[str, Any]]:
        """Generate comprehensive hospital selection guidance with sources."""
        guidance_prompt = f"""User query: "{query}"

Comprehensive facility research:
{facility_info}

Based on this healthcare facility information, provide detailed guidance that follows this structure:

**Understanding Your Healthcare Options**
- Overview of available healthcare facilities and their characteristics
- Types of care settings and when each is most appropriate
- How different facilities serve different medical needs

**Facility Quality and Safety Information**
- Quality ratings, safety scores, and accreditation status of recommended facilities
- How to interpret quality metrics and patient satisfaction scores
- Comparison of performance indicators between different facilities
- Awards, recognitions, and centers of excellence

**Emergency vs. Routine Care Guidance**
- When to seek emergency care vs. urgent care vs. routine appointments
- Emergency department capabilities and trauma center designations
- Expected processes and wait times for different types of care
- How to prepare for emergency situations

**Specialty Services and Advanced Care**
- Specialized departments and programs available
- Centers of excellence and unique capabilities
- Advanced procedures and technology offerings
- Multidisciplinary care teams and collaborative approaches

**Financial Planning and Insurance Considerations**
- Insurance acceptance and network participation
- Estimated costs and financial assistance programs
- How to navigate billing and payment options
- Resources for financial planning and support
- Surprise billing protections and patient rights

**Accessibility and Patient Experience**
- Transportation options, parking, and accessibility features
- Language services and cultural competency programs
- Patient support services and amenities
- Visiting policies and family accommodations

**Making Healthcare Appointments**
- How to schedule appointments and what to expect
- Preparation requirements for different types of visits
- Wait times and expedited scheduling for urgent needs
- Telemedicine and virtual care options available

**Navigating the Healthcare System**
- How to prepare for medical appointments effectively
- Questions to ask healthcare providers
- Understanding your rights as a patient
- How to advocate for yourself or loved ones
- Resources for getting second opinions

**Working with Healthcare Providers**
- How to find and verify physician credentials
- Understanding different types of medical specialists
- Building effective relationships with your healthcare team
- Communication strategies for better care outcomes

**Long-term Healthcare Planning**
- Building relationships with primary care providers
- Coordinating care between different specialists and facilities
- Managing chronic conditions and ongoing health needs
- Preventive care and health maintenance strategies

**SOURCE HANDLING:**
- If the facility information included internet research with specific sources and URLs, include those in a "Verified Sources and References" section
- If the facility information was based on general healthcare knowledge, do not add a sources section
- Only include sources when they were actually obtained from internet research about specific facilities

Provide practical, actionable guidance while noting that healthcare needs are individual and may require personalized consultation with healthcare providers."""
        
        return await self._generate_response(guidance_prompt, model=self.model) 