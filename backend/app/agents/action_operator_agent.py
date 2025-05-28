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
    Uses intelligent LLM-based classification for better accuracy.
    """
    
    INTENTS = [
        "greeting",
        "symptom_inquiry", 
        "treatment_advice",
        "hospital_search",
        "department_inquiry",
        "deep_medical_inquiry",
        "unbiased_factual_request",
        "comprehensive_health_assessment",
        "unknown"
    ]
    
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
    
    async def _detect_intent_with_sonar(self, query: str) -> str:
        """Use Sonar model to dynamically detect intent from the query."""
        prompt = f"""Analyze this medical/healthcare query and classify it into ONE of these categories:

**Intent Categories:**
1. **greeting** - Basic greetings, introductions, casual conversation starters
2. **symptom_inquiry** - Questions about symptoms, feeling sick, pain, discomfort, health issues
3. **treatment_advice** - Questions about treating conditions, medications, therapies, remedies
4. **hospital_search** - Looking for hospitals, clinics, medical facilities, doctors nearby
5. **department_inquiry** - Which medical specialist or department to consult
6. **deep_medical_inquiry** - Research questions, breakthroughs, studies, latest medical developments, clinical trials
7. **unbiased_factual_request** - Requests for balanced, factual information on controversial medical topics
8. **comprehensive_health_assessment** - Requests for complete health evaluations, thorough assessments, full medical analysis
9. **unknown** - Does not fit any medical/healthcare category

**Query to classify:** "{query}"

**Instructions:**
- Analyze the user's primary intent and goal
- Consider the context and what the user is actually asking for
- If multiple intents seem possible, choose the most specific and relevant one
- Focus on what action or information the user wants

**Response:** Return ONLY the category name without any formatting (e.g., comprehensive_health_assessment)"""

        try:
            response, _ = await self._generate_response(prompt, model=self.sonar)
            
            # Clean up the response - remove markdown, extra spaces, etc.
            intent = response.strip().lower()
            
            # Remove common markdown formatting
            intent = intent.replace('**', '').replace('*', '').replace('`', '')
            
            # Remove quotes and other punctuation
            intent = intent.replace('"', '').replace("'", '').replace('.', '').replace(',', '')
            
            # Extract just the intent name if it's in a sentence
            for valid_intent in self.INTENTS:
                if valid_intent in intent:
                    intent = valid_intent
                    break
            
            # Validate the cleaned response
            if intent in self.INTENTS:
                return intent
            else:
                logger.warning(f"Invalid intent from Sonar: '{response}' (cleaned: '{intent}'). Defaulting to 'symptom_inquiry'.")
                return "symptom_inquiry"
                
        except Exception as e:
            logger.error(f"Error in Sonar intent detection: {str(e)}")
            return "symptom_inquiry"  # Safe fallback
    
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
        Detect the intent of the user query using Sonar model.
        
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
        
        # Use Sonar model for intent detection
        logger.info(f"Using Sonar for intent detection: '{query[:50]}...'")
        
        try:
            intent = await self._detect_intent_with_sonar(query)
            
            # Cache the result
            self._intent_cache[cache_key] = (intent, datetime.now())
            
            # Cleanup cache periodically
            if len(self._intent_cache) % 50 == 0:
                self._cleanup_cache()
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            logger.info(f"Intent classification completed in {processing_time:.2f}ms: '{intent}'")
            
            metadata = {
                "intent": intent,
                "method": "sonar_detection",
                "processing_time_ms": processing_time
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