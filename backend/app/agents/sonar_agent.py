import os
import json
import asyncio
import re
from typing import List, Dict, Any, Tuple, Optional, AsyncGenerator
import logging
from dotenv import load_dotenv
import aiohttp

from perplexipy import PerplexityClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class SonarAgent:
    """
    Enhanced agent that interfaces with the Perplexity Sonar API to generate medical advice responses.
    Supports streaming responses and proper formatting with source citations.
    """
    
    def __init__(self):
        """Initialize the Sonar agent with API keys and configuration."""
        from app.core.config import settings
        self.api_key = settings.PERPLEXITY_API_KEY
        self.sonar = settings.PERPLEXITY_SONAR
        self.sonar_reasoning_pro = settings.PERPLEXITY_SONAR_REASONING_PRO
        self.sonar_deep_research = settings.PERPLEXITY_SONAR_DEEP_RESEARCH
        
        # Check if we have a valid API key
        if not self.api_key:
            logger.warning("No Perplexity API key found. Using mock responses for development.")
            self.client = None
        else:
            # Initialize the Perplexity client
            self.client = PerplexityClient(key=self.api_key)
        
        # Enhanced system prompt for comprehensive medical advice with sources
        self.system_prompt = """
        You are SonarCare, an advanced AI medical assistant designed to provide comprehensive, accurate, and evidence-based 
        information about health topics. Your mission is to deliver maximum value through detailed, well-researched responses
        with proper citations and sources when you perform internet searches.
        
        CORE PRINCIPLES:
        1. COMPREHENSIVE INFORMATION: Provide thorough, detailed responses that cover all relevant aspects of the health topic
        2. EVIDENCE-BASED: Draw from reputable medical sources, current research, and established medical guidelines
        3. PRACTICAL VALUE: Include actionable information, management strategies, and clear guidance
        4. SAFETY FIRST: Prioritize patient safety and clearly indicate when immediate medical attention is needed
        5. EMPATHETIC CARE: Be understanding, supportive, and sensitive to the user's concerns
        6. EDUCATIONAL: Help users understand their health better with clear explanations
        7. TRANSPARENT SOURCING: When you search the internet, always provide and cite your sources with actual URLs
        
        RESPONSE REQUIREMENTS - PROVIDE MAXIMUM INFORMATION:
        
        For SYMPTOMS/CONDITIONS:
        - Detailed explanation of the condition and its mechanisms
        - Comprehensive list of potential causes (common and less common)
        - Full spectrum of symptoms and their variations
        - Risk factors and predisposing conditions
        - Natural progression and typical timeline
        - Complications to be aware of
        - Demographics most affected
        - Relationship to other conditions
        
        For TREATMENTS/MANAGEMENT:
        - Multiple treatment approaches (medical, lifestyle, alternative when appropriate)
        - Specific medications commonly used (with general information about mechanisms)
        - Lifestyle modifications and their evidence base
        - Preventive measures and their effectiveness
        - Self-care strategies with specific instructions
        - Expected outcomes and timelines
        - Monitoring recommendations
        - When to follow up with healthcare providers
        
        For DIAGNOSTIC INFORMATION:
        - Tests commonly used for diagnosis
        - What each test involves and what it measures
        - Typical findings and their significance
        - Differential diagnoses to consider
        - When specific tests are indicated
        
        For EMERGENCY/URGENT SITUATIONS:
        - Clear red flags requiring immediate attention
        - Emergency vs urgent vs routine care distinctions
        - What to expect in emergency settings
        - How to communicate symptoms effectively to healthcare providers
        
        ENHANCED FORMATTING STRUCTURE:
        Always organize comprehensive responses with clear sections:
        - **Understanding [Condition/Topic]**: Detailed explanation and background
        - **Causes and Risk Factors**: Comprehensive list with explanations
        - **Symptoms and Manifestations**: Full spectrum of presentations
        - **Management and Treatment Options**: Multiple approaches with details
        - **Lifestyle and Self-Care**: Specific actionable recommendations
        - **When to Seek Medical Attention**: Clear guidelines with urgency levels
        - **Prevention and Long-term Outlook**: Forward-looking guidance
        - **Working with Healthcare Providers**: How to optimize medical care
        
        SOURCE CITATION REQUIREMENTS (ONLY WHEN INTERNET SEARCH IS PERFORMED):
        - IF you searched the internet for current information, use numbered citations [1], [2], etc. within the text
        - IF you performed web search, include a "**Verified Sources and References**" section at the end
        - Include actual URLs, publication titles, organization names, and dates from your search results
        - Format URLs as clickable markdown links: [URL text](URL) for better user experience
        - Prioritize sources from: medical journals, government health agencies, professional medical organizations,
          established medical institutions, peer-reviewed research, clinical guidelines
        - Clearly state: "This response includes information from recent internet research" when applicable
        - IF you did NOT search the internet, do NOT include a sources section - simply provide comprehensive information based on medical knowledge
        
        COMMUNICATION GUIDELINES:
        - Use clear, accessible language while maintaining medical accuracy
        - Explain medical terms when first used
        - Provide specific examples and practical details
        - Include relevant statistics and prevalence when helpful
        - Address common concerns and misconceptions
        - Be thorough but well-organized for easy reading
        - Only mention sources when you actually searched for current information online
        
        SAFETY AND LIMITATIONS:
        - Clearly distinguish between general information and personalized medical advice
        - Emphasize the importance of professional medical evaluation for diagnosis and treatment
        - Note when symptoms require urgent or emergency care
        - Acknowledge limitations of AI-provided information
        - Encourage informed healthcare discussions
        - Provide sources only when you performed internet research
        
        QUALITY STANDARDS:
        - Ensure all information is current and evidence-based
        - Avoid outdated or deprecated medical practices
        - Include multiple perspectives when there are different treatment approaches
        - Provide context for controversial or evolving areas of medicine
        - Balance thoroughness with clarity and readability
        - Include verifiable sources and references ONLY when you searched the internet
        
        Remember: Your goal is to provide maximum value through comprehensive, well-researched responses that empower users 
        to make informed decisions about their health while maintaining appropriate safety boundaries. Only include sources
        and citations when you actually performed internet research to gather current information.
        """
    
    def _clean_response_formatting(self, text: str) -> str:
        """
        Clean up the response to improve readability while preserving sources and citations.
        This version preserves numbered references and links instead of removing them.
        """
        # Preserve numbered references like [1], [2], etc. - these are important citations
        # Keep URLs - these are valuable source links
        
        # Improve structure with proper spacing
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Normalize paragraph breaks
        
        # Fix common formatting issues
        text = re.sub(r'([a-z])([A-Z][a-z])', r'\1 \2', text)  # Add space between joined words
        
        # Clean up excessive whitespace (but preserve intentional formatting)
        text = re.sub(r' {2,}', ' ', text)  # Multiple spaces to single
        text = re.sub(r'\n {2,}', '\n', text)  # Remove leading spaces from new lines
        
        # Ensure proper section headers
        text = re.sub(r'(\n|^)([A-Z][^.!?]*):(\s|$)', r'\1**\2:**\3', text)  # Bold section headers
        
        # Fix incomplete markdown formatting - but avoid adding extra asterisks to properly formatted text
        # Only close incomplete bold if there's an odd number of ** sequences
        if text.count('**') % 2 == 1:
            text = re.sub(r'\*\*([^*]+)$', r'**\1**', text)
        # Only close incomplete italic if there's an odd number of single * (excluding those that are part of **)
        single_asterisks = len(re.findall(r'(?<!\*)\*(?!\*)', text))
        if single_asterisks % 2 == 1:
            text = re.sub(r'(?<!\*)\*([^*]+)$', r'*\1*', text)
        
        return text.strip()
    
    def _extract_and_format_sources(self, response_data: Any) -> Tuple[str, List[str]]:
        """
        Extract sources from Perplexity API response and format them properly.
        Only creates a sources section when actual URLs from internet search are found.
        
        Args:
            response_data: The full response data from Perplexity API
            
        Returns:
            Tuple of (sources_section, source_urls)
        """
        sources = []
        source_urls = []
        
        def format_url_as_link(url: str) -> str:
            """Format URL as a clickable markdown link with readable text."""
            # Create readable link text based on domain
            if 'mayoclinic.org' in url:
                link_text = "Mayo Clinic"
            elif 'pubmed.ncbi.nlm.nih.gov' in url:
                link_text = "PubMed / NCBI"
            elif 'nih.gov' in url:
                link_text = "National Institutes of Health"
            elif 'cdc.gov' in url:
                link_text = "Centers for Disease Control"
            elif 'who.int' in url:
                link_text = "World Health Organization"
            elif 'webmd.com' in url:
                link_text = "WebMD"
            elif 'cochranelibrary.com' in url:
                link_text = "Cochrane Library"
            elif 'ama-assn.org' in url:
                link_text = "American Medical Association"
            elif 'cms.gov' in url:
                link_text = "Centers for Medicare & Medicaid Services"
            elif 'fda.gov' in url:
                link_text = "U.S. Food and Drug Administration"
            elif 'cancer.gov' in url:
                link_text = "National Cancer Institute"
            elif 'heart.org' in url:
                link_text = "American Heart Association"
            elif 'diabetes.org' in url:
                link_text = "American Diabetes Association"
            else:
                # Extract domain name as fallback
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(url).netloc
                    link_text = domain.replace('www.', '')
                except:
                    link_text = url
            
            return f"[{link_text}]({url})"
        
        # Check if response_data has citations (for actual API responses)
        if hasattr(response_data, 'citations') and response_data.citations:
            for i, citation in enumerate(response_data.citations, 1):
                # Only include if it's an actual URL
                if citation.startswith(('http://', 'https://')):
                    # Format as clickable markdown link with readable text
                    formatted_link = format_url_as_link(citation)
                    sources.append(f"[{i}] {formatted_link}")
                    source_urls.append(citation)
        elif isinstance(response_data, dict) and 'citations' in response_data:
            for i, citation in enumerate(response_data['citations'], 1):
                # Only include if it's an actual URL
                if citation.startswith(('http://', 'https://')):
                    # Format as clickable markdown link with readable text
                    formatted_link = format_url_as_link(citation)
                    sources.append(f"[{i}] {formatted_link}")
                    source_urls.append(citation)
        
        # Only create sources section if we have actual URLs from internet search
        if sources and len(source_urls) > 0:
            sources_section = "\n\n**Verified Sources and References:**\n\n"
            sources_section += "This response includes information from recent internet research. You can verify the information using these sources:\n\n"
            for source in sources:
                sources_section += f"• {source}\n"
            sources_section += "\n*Please verify information with these sources and consult healthcare professionals for personalized medical advice.*"
            return sources_section, source_urls
        
        # No sources section if no internet URLs were found
        return "", []
    
    async def generate_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a response using the Perplexity Sonar API with proper source handling.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # If we don't have a client, return mock response
        if not self.client:
            return await self._generate_mock_response(query, message_history)
        
        try:
            # Format message history for the Perplexity API
            formatted_messages = self._format_messages(query, message_history)
            
            # Create message list for PerplexiPy
            messages = []
            for msg in formatted_messages:
                messages.append(f"{msg['role']}: {msg['content']}")
            
            # Call the PerplexiPy client
            response_text = self.client.query("\n".join(messages))
            
            # For PerplexiPy, we might not get structured response data with citations
            # The client may return just text, so we'll handle this gracefully
            sources_section, source_urls = self._extract_and_format_sources(None)
            
            # Clean the response formatting while preserving citations
            response_text = self._clean_response_formatting(response_text)
            
            # Add sources section if we have any
            if sources_section:
                response_text += sources_section
            
            # Create metadata for compatibility
            metadata = {
                "sonar": self.sonar,
                "sonar_reasoning_pro": self.sonar_reasoning_pro,
                "sonar_deep_research": self.sonar_deep_research,
                "tokens": {
                    "prompt": len(query.split()),
                    "completion": len(response_text.split()),
                    "total": len(query.split()) + len(response_text.split())
                },
                "formatted": True,
                "sources": source_urls,
                "has_sources": len(source_urls) > 0,
                "grounded": len(source_urls) > 0
            }
            
            return response_text, metadata
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise
    
    async def generate_streaming_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate a streaming response for real-time display with proper source handling.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Yields:
            Dict containing streaming data with keys: type, data, done
        """
        try:
            # Generate the full response first (we'll improve this later for true streaming)
            response_text, metadata = await self.generate_response(query, message_history)
            
            # Yield start signal
            yield {
                "type": "start",
                "data": "",
                "done": False,
                "metadata": metadata
            }
            
            # Split by sentences to preserve natural formatting
            sentences = re.split(r'([.!?]\s+)', response_text)
            current_text = ""
            
            for i, segment in enumerate(sentences):
                current_text += segment
                
                # Emit at sentence boundaries or when we have enough content
                should_emit = (
                    segment.strip().endswith(('.', '!', '?')) or  # End of sentence
                    len(current_text) >= 50 or  # Accumulated enough text
                    i == len(sentences) - 1  # Last segment
                )
                
                if should_emit:
                    yield {
                        "type": "chunk",
                        "data": current_text,
                        "done": False,
                        "metadata": {}
                    }
                    
                    # Brief pause for readability
                    if segment.strip().endswith(('.', '!', '?')):
                        await asyncio.sleep(0.15)  # Pause after sentences
                    else:
                        await asyncio.sleep(0.05)  # Brief pause otherwise
            
            # Yield final response
            yield {
                "type": "end",
                "data": response_text,
                "done": True,
                "metadata": metadata
            }
            
        except Exception as e:
            yield {
                "type": "error",
                "data": f"Error generating response: {str(e)}",
                "done": True,
                "metadata": {"error": str(e)}
            }
    
    def _format_messages(self, query: str, message_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format the message history into the format expected by the Perplexity API.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            List of formatted message dictionaries
        """
        formatted_messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        # Add message history (up to the last 6 messages to avoid context length issues)
        for message in message_history[-6:]:
            role = "assistant" if message["sender"] == "bot" else "user"
            formatted_messages.append({"role": role, "content": message["text"]})
        
        # Add the current query
        formatted_messages.append({"role": "user", "content": query})
        
        return formatted_messages
    
    async def _generate_mock_response(
        self, 
        query: str, 
        message_history: List[Dict[str, Any]]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate a dynamic, comprehensive mock response for development without API keys.
        Only includes mock sources when simulating internet research scenarios.
        
        Args:
            query: The current user query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (response_text, metadata)
        """
        # Add a slight delay to simulate API call
        await asyncio.sleep(0.5)
        
        # Analyze the query to determine the type of response needed
        query_lower = query.lower()
        
        # Check if this query would require internet research
        needs_internet_research = any(word in query_lower for word in [
            "latest", "recent", "new", "current", "breakthrough", "research", 
            "study", "trial", "hospital", "clinic", "doctor", "specialist",
            "treatment options", "new medication", "clinical trial"
        ])
        
        # Generate response based on query type
        if any(word in query_lower for word in ["hello", "hi", "hey", "greetings", "start"]):
            response_text = """**Welcome to SonarCare**

Hello! I'm SonarCare, your comprehensive AI medical assistant with advanced research capabilities. I provide detailed, evidence-based health information, and when I search the internet for current information, I'll provide you with verified sources and links.

**Enhanced Research Capabilities**

I can provide comprehensive information about:
- **Symptoms and Conditions**: Detailed explanations based on established medical knowledge
- **Treatment Options**: Evidence-based approaches from clinical guidelines
- **Preventive Care**: Strategies backed by medical research
- **Medical Departments**: Guidance on healthcare specialties
- **Emergency Situations**: Clear protocols based on medical guidelines
- **Health Education**: In-depth explanations from medical knowledge

**Internet Research & Source Verification**

When I need to search for current information, I will:
- Provide numbered citations [1], [2], etc. throughout my response
- Include a "Verified Sources and References" section with actual URLs
- Clearly indicate that the response includes internet research
- Link to medical journals, health organizations, and authoritative sources

**Important Medical Disclaimer**

I provide general health information for educational purposes. When I search the internet, I'll provide verifiable sources. This information is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for personalized medical guidance.

What health topic would you like me to help you with today?"""
            
            # No sources for greeting - it's based on general capabilities
            mock_sources = []
            
        else:
            # For medical queries, determine if mock internet research is needed
            if needs_internet_research:
                response_text = f"""**Understanding Your Health Concern**

Thank you for your question about {self._extract_topic_from_query(query)}. For this type of query, I would normally search current medical research and authoritative sources to provide you with the most up-to-date information.

**Simulated Internet Research Response**

In a live environment, I would search for and provide:

**Current Medical Guidelines**: Latest recommendations from medical organizations and professional societies regarding {self._extract_topic_from_query(query)} [1].

**Recent Research Findings**: Current studies and clinical trials that inform best practices for diagnosis and treatment [2].

**Healthcare Facility Information**: Quality ratings, services available, and patient reviews from verified databases [3].

**Professional Resources**: Links to specialist directories and medical board certifications [4].

**Clinical Evidence**: Peer-reviewed research and evidence-based treatment protocols [5].

**Professional Medical Advice Needed**

For your specific situation, I recommend consulting with a healthcare provider who can:
- Perform a proper medical evaluation
- Consider your individual medical history
- Provide personalized treatment recommendations
- Monitor your progress and adjust care as needed

**Verified Sources and References**

This response includes information from recent internet research. You can verify the information using these sources:

• [1] [Mayo Clinic](https://www.mayoclinic.org/diseases-conditions)
• [2] [PubMed / NCBI](https://pubmed.ncbi.nlm.nih.gov/)
• [3] [Centers for Medicare & Medicaid Services](https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/CertificationandComplianc/Hospitals)
• [4] [American Medical Association](https://www.ama-assn.org/practice-management/physician-resources/physician-finder)
• [5] [Cochrane Library](https://www.cochranelibrary.com/)

*Please verify information with these sources and consult healthcare professionals for personalized medical advice.*

*This is a development mode simulation. In live operation, I would provide actual current research findings and real-time source citations.*"""
                
                # Include mock sources for research-type queries
                mock_sources = [
                    "https://www.mayoclinic.org/diseases-conditions",
                    "https://pubmed.ncbi.nlm.nih.gov/",
                    "https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/CertificationandComplianc/Hospitals",
                    "https://www.ama-assn.org/practice-management/physician-resources/physician-finder",
                    "https://www.cochranelibrary.com/"
                ]
            else:
                # For general medical knowledge queries, no internet research needed
                response_text = f"""**Understanding {self._extract_topic_from_query(query).title()}**

Based on established medical knowledge, I can provide you with comprehensive information about {self._extract_topic_from_query(query)}.

**Medical Background**

This topic involves several important aspects that are well-documented in medical literature and clinical practice guidelines.

**Key Information**

- **Detailed Explanation**: Comprehensive overview of the condition, its mechanisms, and how it affects the body
- **Symptoms and Signs**: Full spectrum of presentations and manifestations
- **Causes and Risk Factors**: Known contributing factors and predisposing conditions
- **Management Approaches**: Evidence-based treatment options and interventions
- **Lifestyle Considerations**: Practical recommendations for daily management
- **When to Seek Care**: Clear guidelines for medical consultation

**Professional Medical Advice**

While this information is based on established medical knowledge, individual cases vary significantly. For personalized guidance:
- Consult with qualified healthcare providers
- Discuss your specific symptoms and medical history
- Follow professional medical recommendations
- Seek appropriate specialist care when needed

**Additional Resources**

For the most current research and guidelines, consider consulting:
- Your healthcare provider
- Reputable medical organizations
- Peer-reviewed medical literature
- Professional medical societies

*This response is based on general medical knowledge and does not include internet research. For current studies or facility-specific information, please let me know if you'd like me to search for recent updates.*"""
                
                # No sources for general knowledge responses
                mock_sources = []
        
        # Create metadata based on whether sources are included
        metadata = {
            "model": "enhanced-mock-sonar-conditional-sources",
            "tokens": {
                "prompt": len(query.split()),
                "completion": len(response_text.split()),
                "total": len(query.split()) + len(response_text.split())
            },
            "response_type": "comprehensive",
            "enhanced_system": True,
            "mock": True,
            "sources": mock_sources,
            "has_sources": len(mock_sources) > 0,
            "grounded": len(mock_sources) > 0,
            "internet_research_simulated": needs_internet_research,
            "query_analysis": {
                "topic_extracted": self._extract_topic_from_query(query),
                "needs_research": needs_internet_research,
                "response_structure": "comprehensive_medical_format_conditional_sources"
            }
        }
        
        return response_text, metadata
    
    def _extract_topic_from_query(self, query: str) -> str:
        """Extract the main health topic from a query for better response contextualization."""
        query_lower = query.lower()
        
        # Common health topics mapping
        health_topics = {
            "headache": "headaches and head pain",
            "migraine": "migraines and headache disorders",
            "fever": "fever and temperature regulation",
            "pain": "pain management",
            "cough": "respiratory symptoms",
            "cold": "common cold and viral infections",
            "flu": "influenza and viral illnesses",
            "diabetes": "diabetes and blood sugar management",
            "blood pressure": "hypertension and cardiovascular health",
            "heart": "cardiovascular health",
            "stomach": "digestive health",
            "anxiety": "mental health and anxiety",
            "depression": "mental health and mood disorders",
            "sleep": "sleep disorders and sleep health",
            "diet": "nutrition and dietary health",
            "exercise": "physical activity and fitness",
            "weight": "weight management and metabolism",
            "skin": "dermatological health",
            "eyes": "eye health and vision",
            "ears": "hearing and ear health",
            "back": "back pain and spinal health",
            "joint": "joint health and arthritis",
            "infection": "infections and immune health",
            "allergy": "allergies and immune responses",
            "medication": "medication information and drug interactions",
            "vitamin": "vitamins and nutritional supplements",
            "pregnancy": "pregnancy and reproductive health",
            "child": "pediatric health and child development"
        }
        
        # Find matching topics
        for keyword, topic in health_topics.items():
            if keyword in query_lower:
                return topic
        
        # Default return
        return "your health concern"