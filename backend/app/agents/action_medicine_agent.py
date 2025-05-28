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
        """Get comprehensive factual information about the condition."""
        search_prompt = f"""Provide comprehensive, detailed medical information about {condition}. This is a request for established medical knowledge, not requiring internet search unless specifically needed for current research or latest guidelines.

PATHOPHYSIOLOGY AND BACKGROUND:
- Detailed explanation of how {condition} develops and affects the body
- Underlying biological mechanisms and physiological processes
- Relationship to other medical conditions and body systems
- Demographics and epidemiology (who is most affected, prevalence rates)

SYMPTOMS AND CLINICAL PRESENTATION:
- Complete spectrum of symptoms (early, progressive, and advanced stages)
- Variations in presentation between different populations (age groups, genders, ethnicities)
- Associated symptoms and secondary manifestations
- How symptoms progress over time and potential complications

CAUSES AND RISK FACTORS:
- Primary causes (genetic, environmental, lifestyle, infectious, etc.)
- Modifiable and non-modifiable risk factors
- Protective factors and preventive measures
- Triggers and precipitating factors

DIAGNOSTIC APPROACHES:
- Tests commonly used for diagnosis and their purposes
- Physical examination findings and clinical signs
- Laboratory tests, imaging studies, and specialized procedures
- Differential diagnoses to consider
- Diagnostic criteria and guidelines

TREATMENT AND MANAGEMENT:
- Evidence-based medical treatments and their mechanisms of action
- Medication options with general information about how they work
- Non-pharmacological interventions and their effectiveness
- Surgical options when applicable
- Lifestyle modifications and their evidence base
- Complementary and alternative approaches when appropriate

PROGNOSIS AND OUTCOMES:
- Typical course and progression of the condition
- Expected outcomes with and without treatment
- Potential complications and long-term effects
- Quality of life considerations
- Recovery timelines and factors affecting prognosis

IF YOU SEARCH THE INTERNET for current information about {condition}:
- Use numbered citations [1], [2], etc. throughout your response
- Include actual URLs from your search results
- Format URLs as clickable markdown links: [URL text](URL) for better user experience
- Prioritize: medical journals, government health agencies, professional medical organizations, established medical institutions
- At the end, provide a "Verified Sources and References" section with all URLs and citations
- Clearly state that the response includes recent internet research

IF YOU DO NOT search the internet (using established medical knowledge):
- Do not include a sources section
- Provide comprehensive information based on established medical knowledge
- Note at the end: "This response is based on established medical knowledge. For the latest research or guidelines, please consult current medical literature or your healthcare provider."

Focus on current medical knowledge, evidence-based information, and practical clinical relevance."""
        
        facts_response, _ = await self._generate_response(search_prompt, model=self.model)
        return facts_response
    
    async def _generate_safe_advice(self, query: str, medical_facts: str) -> Tuple[str, Dict[str, Any]]:
        """Generate comprehensive, safe medical advice based on the facts and query."""
        advice_prompt = f"""User query: "{query}"

Comprehensive medical research context:
{medical_facts}

Based on this comprehensive medical information, provide a detailed, helpful response that follows this enhanced structure:

**Understanding [Condition/Topic]**
- Detailed explanation of the condition and how it affects the body
- Medical background and context for better understanding
- Why this condition occurs and its relationship to overall health

**Causes and Risk Factors**
- Comprehensive list of potential causes (immediate and underlying)
- Risk factors that increase likelihood of developing this condition
- Protective factors and prevention strategies
- Environmental, genetic, and lifestyle contributors

**Symptoms and Manifestations**
- Complete spectrum of symptoms from mild to severe
- How symptoms typically progress over time
- Variations in presentation between different people
- Associated symptoms and secondary effects to be aware of

**Management and Treatment Options**
- Evidence-based medical treatments and their approaches
- Lifestyle modifications with specific, actionable recommendations
- Self-care strategies that can provide relief and support healing
- Professional treatment options and how they work
- Expected timelines for improvement and recovery

**Lifestyle and Self-Care Strategies**
- Specific dietary recommendations and nutritional considerations
- Exercise and physical activity guidelines appropriate for this condition
- Stress management and mental health considerations
- Sleep hygiene and rest requirements
- Environmental modifications that may help

**When to Seek Medical Attention**
- Clear criteria for routine medical consultation
- Warning signs requiring urgent medical attention
- Emergency symptoms requiring immediate care
- Follow-up recommendations and monitoring guidelines
- Questions to ask healthcare providers

**Prevention and Long-term Outlook**
- Evidence-based prevention strategies
- Lifestyle changes that reduce risk of recurrence
- Long-term management considerations
- Prognosis and what to expect over time

**Working with Healthcare Providers**
- Which type of medical specialist might be most appropriate
- How to prepare for medical appointments
- Important information to track and report
- Treatment options to discuss with healthcare providers

SOURCE HANDLING:
- If the medical facts included internet research with sources, incorporate those citations and include the "Verified Sources and References" section from the facts
- If the medical facts were based on established knowledge without internet search, do not add a sources section
- Only include sources when they were actually obtained from internet research

Maintain an empathetic, supportive tone while providing comprehensive, evidence-based information. Emphasize that this is general health information to support informed decision-making, not personalized medical advice. Encourage professional medical consultation for diagnosis, treatment planning, and ongoing care.

Make the response thorough, educational, and practically useful while maintaining appropriate medical safety boundaries."""
        
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