import logging
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from app.agents.base_agent import BaseActionAgent
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionOperatorAgent(BaseActionAgent):
    """
    Optimized supervisor agent that detects user intent and routes to the appropriate specialized agent.
    Uses caching and simplified classification for better performance.
    """
    
    INTENTS = [
        "greeting",
        "symptom_inquiry", 
        "treatment_advice",
        "hospital_search",
        "department_inquiry",
        "deep_medical_inquiry",
        "unbiased_factual_request",
        "unknown"
    ]
    
    # Simple keyword-based intent detection for common patterns
    INTENT_KEYWORDS = {
        "greeting": ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings"],
        "symptom_inquiry": ["symptoms", "feeling", "pain", "ache", "hurt", "sick", "unwell", "fever", "headache", "nausea"],
        "treatment_advice": ["treatment", "medicine", "medication", "cure", "therapy", "remedy", "how to treat"],
        "hospital_search": ["hospital", "clinic", "medical center", "doctor near", "find doctor", "where can i"],
        "department_inquiry": ["which doctor", "what specialist", "department", "who should i see", "what kind of doctor"],
        "deep_medical_inquiry": ["research", "breakthrough", "study", "studies", "clinical trial", "latest", "recent", "new research", "scientific", "advancement", "discovery", "findings", "evidence", "investigation", "cutting-edge", "innovation", "development", "progress", "emerging", "novel", "current research", "medical research", "breakthroughs"]
    }
    
    def __init__(self):
        """Initialize the operator agent with caching."""
        super().__init__()
        self.sonar = settings.PERPLEXITY_SONAR
        self.sonar_reasoning_pro = settings.PERPLEXITY_SONAR_REASONING_PRO
        self.sonar_deep_research = settings.PERPLEXITY_SONAR_DEEP_RESEARCH
        
        # Simple in-memory cache for intent detection
        self._intent_cache = {}
        self._cache_max_age = timedelta(hours=1)
        self._cache_max_size = 1000
    
    def _get_cache_key(self, query: str) -> str:
        """Generate a cache key for the query."""
        # Normalize the query and create a hash
        normalized = query.lower().strip()
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _detect_intent_by_keywords(self, query: str) -> Optional[str]:
        """Fast keyword-based intent detection for common patterns."""
        query_lower = query.lower()
        
        # Check for greeting patterns
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["greeting"]):
            return "greeting"
        
        # Check for deep medical inquiry patterns (should be checked early)
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["deep_medical_inquiry"]):
            return "deep_medical_inquiry"
        
        # Check for symptom inquiry patterns
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["symptom_inquiry"]):
            return "symptom_inquiry"
        
        # Check for treatment advice patterns
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["treatment_advice"]):
            return "treatment_advice"
        
        # Check for hospital search patterns
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["hospital_search"]):
            return "hospital_search"
        
        # Check for department inquiry patterns
        if any(keyword in query_lower for keyword in self.INTENT_KEYWORDS["department_inquiry"]):
            return "department_inquiry"
        
        return None
    
    def _cleanup_cache(self):
        """Remove old entries from cache."""
        current_time = datetime.now()
        keys_to_remove = []
        
        for key, (intent, timestamp) in self._intent_cache.items():
            if current_time - timestamp > self._cache_max_age:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._intent_cache[key]
        
        # If cache is still too large, remove oldest entries
        if len(self._intent_cache) > self._cache_max_size:
            sorted_items = sorted(self._intent_cache.items(), key=lambda x: x[1][1])
            items_to_remove = len(self._intent_cache) - self._cache_max_size
            for key, _ in sorted_items[:items_to_remove]:
                del self._intent_cache[key]
    
    async def process(self, query: str, message_history: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Detect the intent of the user query with optimization.
        
        Args:
            query: The user's query
            message_history: List of previous messages in the conversation
            
        Returns:
            Tuple of (intent, metadata)
        """
        start_time = datetime.now()
        
        # Check cache first
        cache_key = self._get_cache_key(query)
        if cache_key in self._intent_cache:
            intent, cached_time = self._intent_cache[cache_key]
            if datetime.now() - cached_time < self._cache_max_age:
                logger.info(f"Intent retrieved from cache: '{intent}' for query: '{query[:50]}...'")
                metadata = {
                    "intent": intent,
                    "cached": True,
                    "processing_time_ms": 0
                }
                return intent, metadata
        
        # Try fast keyword-based detection first
        intent = self._detect_intent_by_keywords(query)
        
        if intent:
            logger.info(f"Intent detected by keywords: '{intent}' for query: '{query[:50]}...'")
            # Cache the result
            self._intent_cache[cache_key] = (intent, datetime.now())
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            metadata = {
                "intent": intent,
                "method": "keyword_detection",
                "processing_time_ms": processing_time
            }
            return intent, metadata
        
        # Fall back to LLM-based detection for complex queries
        logger.info(f"Using LLM for intent detection: '{query[:50]}...'")
        
        # Simplified prompt for faster processing
        prompt = f"""Classify this medical query into ONE category:
        
Categories: 
- greeting: Basic greetings and introductions
- symptom_inquiry: Questions about symptoms, feeling sick, pain, discomfort
- treatment_advice: Questions about treating specific conditions or symptoms
- hospital_search: Looking for hospitals, clinics, doctors, medical facilities
- department_inquiry: Which medical specialist or department to see
- deep_medical_inquiry: Research, breakthroughs, studies, latest developments, scientific findings, clinical trials, cutting-edge treatments, medical innovations, recent advances
- unbiased_factual_request: Requests for balanced, factual information on controversial topics
- unknown: Does not fit any category

Query: "{query}"

Examples:
"cancer research breakthroughs" → deep_medical_inquiry
"latest treatment for diabetes" → deep_medical_inquiry
"recent studies on heart disease" → deep_medical_inquiry
"I have a headache" → symptom_inquiry
"find hospitals near me" → hospital_search

Return only the category name."""
        
        try:
            # Generate the intent classification
            intent_response, llm_metadata = await self._generate_response(prompt)
            
            # Clean up and validate the response
            intent = intent_response.strip().lower()
            
            if intent not in self.INTENTS:
                logger.warning(f"Invalid intent detected: '{intent_response}'. Defaulting to 'symptom_inquiry'.")
                intent = "symptom_inquiry"
            
            # Cache the result
            self._intent_cache[cache_key] = (intent, datetime.now())
            
            # Cleanup cache periodically
            if len(self._intent_cache) % 50 == 0:
                self._cleanup_cache()
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            logger.info(f"Intent classification completed in {processing_time:.2f}ms: '{intent}'")
            
            # Add intent to metadata
            metadata = {
                "intent": intent,
                "method": "llm_detection",
                "processing_time_ms": processing_time,
                "original_intent_response": intent_response.strip(),
                **llm_metadata
            }
            
            return intent, metadata
            
        except Exception as e:
            logger.error(f"Error in intent detection: {str(e)}")
            # Default fallback
            intent = "symptom_inquiry"
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            metadata = {
                "intent": intent,
                "method": "fallback",
                "processing_time_ms": processing_time,
                "error": str(e)
            }
            
            return intent, metadata