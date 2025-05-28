import re
import logging
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class IntentPattern:
    """Represents an intent detection pattern with keywords and rules."""
    intent: str
    keywords: List[str]
    patterns: List[str]
    priority: int = 1
    
class FastIntentClassifier:
    """
    Ultra-fast local intent classifier using pattern matching and keywords.
    Achieves <10ms classification time vs 1-3s for LLM-based classification.
    """
    
    def __init__(self):
        """Initialize the fast intent classifier with predefined patterns."""
        self.intent_patterns = self._load_intent_patterns()
        self._cache = {}
        self._cache_hits = 0
        self._total_queries = 0
    
    def _load_intent_patterns(self) -> List[IntentPattern]:
        """Load predefined intent patterns optimized for medical queries."""
        return [
            # Greeting patterns - highest priority for quick detection
            IntentPattern(
                intent="greeting",
                keywords=["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings", "start"],
                patterns=[
                    r"^(hello|hi|hey|good\s+(morning|afternoon|evening)|greetings?)\b",
                    r"^(start|begin|let's start)",
                    r"^(how are you|what's up)"
                ],
                priority=10
            ),
            
            # Symptom inquiry patterns
            IntentPattern(
                intent="symptom_inquiry",
                keywords=["pain", "hurt", "ache", "symptom", "feeling", "sick", "nausea", "fever", "headache", "cough", "sore", "tired", "fatigue", "dizzy", "rash", "swelling", "bleeding", "shortness of breath"],
                patterns=[
                    r"\b(pain|hurt|ache|aching)\b",
                    r"\b(feeling\s+(sick|unwell|bad|awful|terrible))",
                    r"\b(have\s+(symptoms?|fever|headache|cough))",
                    r"\b(experiencing\s+)",
                    r"\bwhat\s+(is|could\s+be)\s+(wrong|causing)",
                    r"\bwhy\s+(do\s+i|am\s+i)\s+(feel|have|experiencing)"
                ],
                priority=8
            ),
            
            # Treatment advice patterns
            IntentPattern(
                intent="treatment_advice",
                keywords=["treatment", "medicine", "medication", "cure", "remedy", "therapy", "heal", "drug", "prescription", "dose", "dosage", "antibiotic", "pill", "tablet"],
                patterns=[
                    r"\b(treatment|therapy|cure|remedy)\s+(for|of)",
                    r"\b(how\s+to\s+(treat|cure|heal))",
                    r"\b(medicine|medication|drug|prescription)\s+(for|to)",
                    r"\b(what\s+(medicine|medication|drug|treatment))",
                    r"\b(dosage|dose|how\s+much)"
                ],
                priority=7
            ),
            
            # Hospital/doctor search patterns
            IntentPattern(
                intent="hospital_search",
                keywords=["hospital", "clinic", "doctor", "physician", "medical center", "emergency room", "urgent care", "specialist", "near me", "nearby", "location", "address"],
                patterns=[
                    r"\b(hospital|clinic|medical\s+center)\s+(near|nearby|close)",
                    r"\b(find\s+(hospital|clinic|doctor|physician))",
                    r"\b(where\s+(is|can\s+i\s+find)\s+(hospital|clinic|doctor))",
                    r"\b(emergency\s+room|urgent\s+care)",
                    r"\b(near\s+me|nearby|in\s+my\s+area)"
                ],
                priority=6
            ),
            
            # Department inquiry patterns
            IntentPattern(
                intent="department_inquiry",
                keywords=["specialist", "department", "cardiology", "neurology", "dermatology", "orthopedic", "pediatric", "oncology", "psychiatry", "gynecology", "urology"],
                patterns=[
                    r"\b(what\s+(specialist|department))",
                    r"\b(which\s+(doctor|specialist))",
                    r"\b(should\s+i\s+see\s+(a|an))\s+(specialist|doctor)",
                    r"\b(cardiology|neurology|dermatology|orthopedic|pediatric|oncology|psychiatry|gynecology|urology)\b"
                ],
                priority=5
            ),
            
            # Deep medical research patterns
            IntentPattern(
                intent="deep_medical_inquiry",
                keywords=["research", "study", "clinical trial", "breakthrough", "latest", "recent", "new research", "medical advance", "scientific", "publication"],
                patterns=[
                    r"\b(latest|recent|new)\s+(research|study|breakthrough|advance)",
                    r"\b(clinical\s+trial|medical\s+study)",
                    r"\b(scientific\s+(evidence|publication|paper))",
                    r"\b(research\s+(shows|indicates|suggests))",
                    r"\b(what\s+(does|do)\s+(research|studies)\s+say)"
                ],
                priority=4
            ),
            
            # Unbiased factual request patterns
            IntentPattern(
                intent="unbiased_factual_request",
                keywords=["facts", "evidence", "pros and cons", "advantages", "disadvantages", "unbiased", "objective", "compare", "comparison", "versus", "vs"],
                patterns=[
                    r"\b(pros\s+and\s+cons|advantages?\s+and\s+disadvantages?)",
                    r"\b(unbiased|objective|neutral)\s+(view|information|facts)",
                    r"\b(compare|comparison|versus|vs)\b",
                    r"\b(fact|facts|evidence)\s+(about|on)",
                    r"\b(what\s+are\s+the\s+(facts|pros|cons))"
                ],
                priority=3
            ),
            
            # Comprehensive health assessment patterns
            IntentPattern(
                intent="comprehensive_health_assessment",
                keywords=["complete", "comprehensive", "full", "thorough", "assessment", "evaluation", "checkup", "analysis", "overall health", "general health"],
                patterns=[
                    r"\b(complete|comprehensive|full|thorough)\s+(assessment|evaluation|checkup|analysis)",
                    r"\b(overall|general)\s+health\s+(assessment|evaluation|check)",
                    r"\b(health\s+(assessment|evaluation|analysis))",
                    r"\b(assess\s+my\s+(health|condition))",
                    r"\b(thorough\s+(evaluation|assessment))"
                ],
                priority=2
            )
        ]
    
    async def classify_intent(self, query: str, message_history: Optional[List[Dict[str, Any]]] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Classify intent using fast pattern matching.
        
        Args:
            query: The user's query
            message_history: Previous messages (for context, if needed)
            
        Returns:
            Tuple of (intent, metadata)
        """
        start_time = datetime.now()
        self._total_queries += 1
        
        # Normalize query for processing
        normalized_query = query.lower().strip()
        
        # Check cache first
        if normalized_query in self._cache:
            self._cache_hits += 1
            intent = self._cache[normalized_query]
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            metadata = {
                "intent": intent,
                "method": "cache_hit",
                "processing_time_ms": processing_time,
                "cache_hit_rate": self._cache_hits / self._total_queries
            }
            return intent, metadata
        
        # Score each intent pattern
        intent_scores = {}
        
        for pattern in self.intent_patterns:
            score = 0
            
            # Keyword matching (weighted by priority)
            keyword_matches = 0
            for keyword in pattern.keywords:
                if keyword in normalized_query:
                    keyword_matches += 1
            
            if keyword_matches > 0:
                score += (keyword_matches / len(pattern.keywords)) * pattern.priority * 10
            
            # Pattern matching (higher weight)
            pattern_matches = 0
            for regex_pattern in pattern.patterns:
                try:
                    if re.search(regex_pattern, normalized_query, re.IGNORECASE):
                        pattern_matches += 1
                except re.error:
                    continue
            
            if pattern_matches > 0:
                score += (pattern_matches / len(pattern.patterns)) * pattern.priority * 20
            
            # Context boost (if we have message history)
            if message_history and len(message_history) > 0:
                last_message = message_history[-1]
                if last_message.get("sender") == "bot" and pattern.intent in last_message.get("text", "").lower():
                    score += 5  # Small context boost
            
            intent_scores[pattern.intent] = score
        
        # Determine the best intent
        if intent_scores:
            best_intent = max(intent_scores, key=intent_scores.get)
            best_score = intent_scores[best_intent]
            
            # Use threshold to determine if we're confident
            confidence_threshold = 10.0
            if best_score >= confidence_threshold:
                detected_intent = best_intent
            else:
                # Default to symptom_inquiry for medical-related queries
                detected_intent = "symptom_inquiry"
        else:
            detected_intent = "symptom_inquiry"
        
        # Cache the result
        self._cache[normalized_query] = detected_intent
        
        # Limit cache size
        if len(self._cache) > 1000:
            # Remove oldest entries (simple FIFO)
            oldest_keys = list(self._cache.keys())[:100]
            for key in oldest_keys:
                del self._cache[key]
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        metadata = {
            "intent": detected_intent,
            "method": "pattern_matching",
            "processing_time_ms": processing_time,
            "confidence_score": intent_scores.get(detected_intent, 0),
            "all_scores": intent_scores,
            "cache_hit_rate": self._cache_hits / self._total_queries
        }
        
        logger.info(f"Fast intent classification: '{detected_intent}' in {processing_time:.2f}ms")
        return detected_intent, metadata
    
    def get_stats(self) -> Dict[str, Any]:
        """Get classifier statistics."""
        return {
            "total_queries": self._total_queries,
            "cache_hits": self._cache_hits,
            "cache_hit_rate": self._cache_hits / max(1, self._total_queries),
            "cache_size": len(self._cache)
        } 