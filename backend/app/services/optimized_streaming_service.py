import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, AsyncGenerator
import aiohttp
import json
from concurrent.futures import ThreadPoolExecutor

from app.services.firebase_service import create_message, get_messages, get_sessions, get_session
from app.agents.fast_intent_classifier import FastIntentClassifier
from app.agents.langgraph_setup import _get_response_agent, _is_healthcare_related
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize fast components
fast_classifier = FastIntentClassifier()
thread_pool = ThreadPoolExecutor(max_workers=4)

# Cache for responses and patterns
response_cache = {}
pattern_cache = {}
CACHE_EXPIRY_MINUTES = 30
MAX_CACHE_ENTRIES = 500

class OptimizedStreamingService:
    """
    Optimized streaming service that achieves fast response times through:
    1. Parallel processing and speculation
    2. Fast local intent classification
    3. True streaming from Perplexity API
    4. Intelligent caching and response optimization
    """
    
    def __init__(self):
        """Initialize the optimized streaming service."""
        self.session = None
        self._setup_http_session()
    
    def _setup_http_session(self):
        """Setup optimized HTTP session for API calls."""
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=10,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        
        timeout = aiohttp.ClientTimeout(total=30, connect=5)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}"}
        )
    
    async def process_message_optimized(
        self, 
        text: str, 
        session_id: str, 
        user_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Process a message with optimized parallel processing and true streaming.
        
        Args:
            text: The user's message text
            session_id: The ID of the chat session
            user_id: The ID of the user
            
        Yields:
            Dict containing streaming response chunks
        """
        start_time = datetime.now()
        logger.info(f"Starting optimized message processing for user {user_id}")
        
        try:
            # Phase 1: Parallel initialization and validation
            yield {
                "type": "status",
                "data": "Processing your question...",
                "done": False
            }
            
            # Start multiple tasks in parallel
            tasks = await self._start_parallel_tasks(text, session_id, user_id)
            
            # Healthcare validation (fast local check)
            healthcare_check = await self._quick_healthcare_check(text)
            if not healthcare_check:
                yield {
                    "type": "start",
                    "data": "",
                    "done": False
                }
                
                rejection_message = self._create_rejection_message(session_id, user_id, start_time)
                yield {
                    "type": "end",
                    "data": rejection_message["text"],
                    "done": True,
                    "message": rejection_message
                }
                return
            
            # Phase 2: Fast intent classification (parallel with message history)
            intent_task, history_task = tasks["intent"], tasks["history"]
            
            # Get results as they complete
            intent, intent_metadata = await intent_task
            message_history = await history_task
            
            classification_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Intent '{intent}' classified in {classification_time:.3f}s")
            
            # Phase 3: Speculative agent preparation and streaming response
            yield {
                "type": "status",
                "data": "Generating response...",
                "done": False
            }
            
            # Check cache for similar responses first
            cached_response = await self._check_response_cache(text, intent)
            if cached_response:
                yield {
                    "type": "start",
                    "data": "",
                    "done": False,
                    "metadata": {"cached": True, "intent": intent}
                }
                
                # Stream the cached response in chunks
                async for chunk in self._stream_cached_response(cached_response):
                    yield chunk
                return
            
            # Phase 4: True streaming from Perplexity API
            async for chunk in self._stream_from_perplexity(text, intent, message_history, session_id, user_id, start_time):
                yield chunk
                
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error in optimized processing after {processing_time:.2f}s: {str(e)}")
            
            yield {
                "type": "error",
                "data": "I'm experiencing technical difficulties. Please try again in a moment.",
                "done": True,
                "metadata": {
                    "error": str(e),
                    "processing_time_seconds": processing_time
                }
            }
    
    async def _start_parallel_tasks(self, text: str, session_id: str, user_id: str) -> Dict[str, asyncio.Task]:
        """Start multiple tasks in parallel for faster processing."""
        tasks = {
            "intent": asyncio.create_task(
                fast_classifier.classify_intent(text)
            ),
            "history": asyncio.create_task(
                self._get_session_messages_fast(session_id, user_id)
            )
        }
        return tasks
    
    async def _quick_healthcare_check(self, text: str) -> bool:
        """Fast local healthcare topic validation using keywords."""
        medical_keywords = {
            'health', 'medical', 'doctor', 'hospital', 'clinic', 'medicine', 'medication',
            'symptoms', 'treatment', 'diagnosis', 'therapy', 'pain', 'illness', 'disease',
            'condition', 'surgery', 'prescription', 'nurse', 'physician', 'specialist',
            'emergency', 'urgent', 'fever', 'headache', 'cough', 'injury', 'wound',
            'infection', 'virus', 'bacteria', 'cancer', 'diabetes', 'heart', 'blood'
        }
        
        text_lower = text.lower()
        
        # Quick keyword check
        for keyword in medical_keywords:
            if keyword in text_lower:
                return True
        
        # Pattern-based check for medical queries
        medical_patterns = [
            r'\bfeel(ing)?\s+(sick|ill|unwell|bad)\b',
            r'\bhurt(s|ing)?\b',
            r'\bpain\b',
            r'\bache\b',
            r'\bsymptom\b',
            r'\bwhat\s+(is|could\s+be)\s+(wrong|causing)\b'
        ]
        
        import re
        for pattern in medical_patterns:
            if re.search(pattern, text_lower):
                return True
        
        # Default to allowing if uncertain (can be filtered by intent later)
        return True
    
    async def _get_session_messages_fast(self, session_id: str, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Fast retrieval of session messages with aggressive caching."""
        cache_key = f"{session_id}:{user_id}:{limit}"
        
        # Check local cache first
        if cache_key in pattern_cache:
            cached_data = pattern_cache[cache_key]
            age_minutes = (datetime.now() - cached_data["timestamp"]).total_seconds() / 60
            if age_minutes < 5:  # 5-minute cache for session messages
                return cached_data["messages"]
        
        try:
            # Get messages from database
            messages = await get_messages(session_id, limit=limit)
            
            # Cache the result
            pattern_cache[cache_key] = {
                "messages": messages,
                "timestamp": datetime.now()
            }
            
            # Cleanup cache if too large
            if len(pattern_cache) > 200:
                self._cleanup_pattern_cache()
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting session messages: {str(e)}")
            return []
    
    async def _check_response_cache(self, text: str, intent: str) -> Optional[str]:
        """Check if we have a cached response for similar queries."""
        # Create cache key from normalized text and intent
        import hashlib
        normalized_text = text.lower().strip()
        cache_key = f"{intent}:{hashlib.md5(normalized_text.encode()).hexdigest()[:16]}"
        
        if cache_key in response_cache:
            cached_data = response_cache[cache_key]
            age_minutes = (datetime.now() - cached_data["timestamp"]).total_seconds() / 60
            
            if age_minutes < CACHE_EXPIRY_MINUTES:
                logger.info(f"Cache hit for intent '{intent}' query")
                return cached_data["response"]
        
        # Check for similar queries using basic text similarity
        for key, data in response_cache.items():
            if key.startswith(f"{intent}:"):
                # Simple similarity check
                cached_query = data.get("original_query", "").lower()
                similarity = self._calculate_similarity(normalized_text, cached_query)
                
                if similarity > 0.8:  # 80% similarity threshold
                    age_minutes = (datetime.now() - data["timestamp"]).total_seconds() / 60
                    if age_minutes < CACHE_EXPIRY_MINUTES:
                        logger.info(f"Similar query cache hit (similarity: {similarity:.2f})")
                        return data["response"]
        
        return None
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate basic text similarity using word overlap."""
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        intersection = words1 & words2
        union = words1 | words2
        
        if not union:
            return 0.0
        
        return len(intersection) / len(union)
    
    async def _stream_cached_response(self, response: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream a cached response in natural chunks."""
        bot_message_id = str(uuid.uuid4())
        
        yield {
            "type": "start",
            "data": "",
            "done": False,
            "metadata": {"cached": True}
        }
        
        # Split into sentences for natural streaming
        import re
        sentences = re.split(r'([.!?]\s+)', response)
        current_text = ""
        
        for i, segment in enumerate(sentences):
            current_text += segment
            
            if segment.strip().endswith(('.', '!', '?')) or len(current_text) >= 100:
                yield {
                    "type": "chunk", 
                    "data": current_text,
                    "done": False
                }
                await asyncio.sleep(0.1)  # Natural reading pace
        
        yield {
            "type": "end",
            "data": response,
            "done": True,
            "metadata": {"cached": True}
        }
    
    async def _stream_from_perplexity(
        self, 
        text: str, 
        intent: str, 
        message_history: List[Dict[str, Any]],
        session_id: str,
        user_id: str,
        start_time: datetime
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response directly from Perplexity API for true real-time streaming."""
        bot_message_id = str(uuid.uuid4())
        
        try:
            # Get the appropriate agent for this intent
            response_agent = _get_response_agent(intent)
            
            # Check if agent supports streaming
            if hasattr(response_agent, 'generate_streaming_response'):
                # Use agent's streaming if available
                full_response = ""
                metadata = {}
                
                async for chunk in response_agent.generate_streaming_response(text, message_history):
                    if chunk["type"] == "start":
                        yield {
                            "type": "start",
                            "data": "",
                            "done": False,
                            "metadata": {"intent": intent, "agent": type(response_agent).__name__}
                        }
                    elif chunk["type"] == "chunk":
                        yield chunk
                        full_response += chunk.get("data", "")
                    elif chunk["type"] == "end":
                        metadata = chunk.get("metadata", {})
                        full_response = chunk.get("data", full_response)
                        
                        # Cache the response
                        await self._cache_response(text, intent, full_response)
                        
                        # Create final message
                        final_message = {
                            "id": bot_message_id,
                            "text": full_response,
                            "sender": "bot",
                            "sessionId": session_id,
                            "userId": user_id,
                            "timestamp": datetime.now().isoformat(),
                            "metadata": {
                                **metadata,
                                "intent": intent,
                                "processing_time_seconds": (datetime.now() - start_time).total_seconds(),
                                "optimized": True
                            }
                        }
                        
                        # Save to database
                        await self._save_message_async(final_message)
                        
                        yield {
                            "type": "end",
                            "data": full_response,
                            "done": True,
                            "message": final_message
                        }
                        
            else:
                # Fallback to non-streaming agent
                response_text, agent_metadata = await response_agent.process(text, message_history)
                
                yield {
                    "type": "start",
                    "data": "",
                    "done": False,
                    "metadata": {"intent": intent, "agent": type(response_agent).__name__}
                }
                
                # Simulate streaming for non-streaming agents
                async for chunk in self._simulate_streaming(response_text):
                    yield chunk
                
                # Cache and save
                await self._cache_response(text, intent, response_text)
                
                final_message = {
                    "id": bot_message_id,
                    "text": response_text,
                    "sender": "bot",
                    "sessionId": session_id,
                    "userId": user_id,
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {
                        **agent_metadata,
                        "intent": intent,
                        "processing_time_seconds": (datetime.now() - start_time).total_seconds(),
                        "optimized": True
                    }
                }
                
                await self._save_message_async(final_message)
                
                yield {
                    "type": "end",
                    "data": response_text,
                    "done": True,
                    "message": final_message
                }
                
        except Exception as e:
            logger.error(f"Error in streaming from Perplexity: {str(e)}")
            yield {
                "type": "error",
                "data": "I encountered an error while generating your response. Please try again.",
                "done": True,
                "metadata": {"error": str(e)}
            }
    
    async def _simulate_streaming(self, text: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Simulate streaming for non-streaming agents."""
        import re
        
        # Split by sentences and punctuation
        chunks = re.split(r'([.!?]\s+|\n\n)', text)
        current_text = ""
        
        for chunk in chunks:
            current_text += chunk
            
            if len(current_text) >= 50 or chunk.strip().endswith(('.', '!', '?')):
                yield {
                    "type": "chunk",
                    "data": current_text,
                    "done": False
                }
                await asyncio.sleep(0.05)  # Brief pause for readability
    
    async def _cache_response(self, text: str, intent: str, response: str):
        """Cache the response for future similar queries."""
        import hashlib
        
        normalized_text = text.lower().strip()
        cache_key = f"{intent}:{hashlib.md5(normalized_text.encode()).hexdigest()[:16]}"
        
        response_cache[cache_key] = {
            "response": response,
            "original_query": normalized_text,
            "timestamp": datetime.now()
        }
        
        # Cleanup cache if too large
        if len(response_cache) > MAX_CACHE_ENTRIES:
            self._cleanup_response_cache()
    
    async def _save_message_async(self, message: Dict[str, Any]):
        """Save message to database asynchronously without blocking."""
        try:
            await create_message(message)
            logger.info(f"Saved message {message['id']} to database")
        except Exception as e:
            logger.error(f"Error saving message to database: {str(e)}")
    
    def _cleanup_response_cache(self):
        """Remove old entries from response cache."""
        current_time = datetime.now()
        keys_to_remove = []
        
        for key, data in response_cache.items():
            age_minutes = (current_time - data["timestamp"]).total_seconds() / 60
            if age_minutes > CACHE_EXPIRY_MINUTES:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del response_cache[key]
        
        # If still too many, remove oldest
        if len(response_cache) > MAX_CACHE_ENTRIES:
            sorted_items = sorted(response_cache.items(), key=lambda x: x[1]["timestamp"])
            for key, _ in sorted_items[:100]:  # Remove oldest 100
                del response_cache[key]
    
    def _cleanup_pattern_cache(self):
        """Remove old entries from pattern cache."""
        current_time = datetime.now()
        keys_to_remove = []
        
        for key, data in pattern_cache.items():
            age_minutes = (current_time - data["timestamp"]).total_seconds() / 60
            if age_minutes > 10:  # Pattern cache expires faster
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del pattern_cache[key]
    
    def _create_rejection_message(self, session_id: str, user_id: str, start_time: datetime) -> Dict[str, Any]:
        """Create a rejection message for non-medical queries."""
        return {
            "id": str(uuid.uuid4()),
            "text": "I'm a medical advice chatbot specialized in healthcare and medical topics. I can only help you with health-related questions, symptoms, treatments, medical procedures, finding doctors or hospitals, and other medical concerns.\n\nPlease ask me something related to health or medicine, and I'll be happy to help you!",
            "sender": "bot",
            "sessionId": session_id,
            "userId": user_id,
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "intent": "non_medical_query",
                "rejected": True,
                "processing_time_seconds": (datetime.now() - start_time).total_seconds(),
                "optimized": True
            }
        }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for monitoring."""
        return {
            "classifier_stats": fast_classifier.get_stats(),
            "response_cache_size": len(response_cache),
            "pattern_cache_size": len(pattern_cache),
            "response_cache_hit_rate": "Not tracked yet",  # Can implement later
        }
    
    async def close(self):
        """Clean up resources."""
        if self.session:
            await self.session.close()

# Global instance
optimized_service = OptimizedStreamingService() 