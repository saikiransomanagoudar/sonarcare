import os
from typing import Dict, Any

class OptimizationConfig:
    """Configuration for performance optimizations."""
    
    # Intent classification settings
    USE_FAST_INTENT_CLASSIFIER = os.getenv("USE_FAST_INTENT_CLASSIFIER", "true").lower() == "true"
    INTENT_CACHE_SIZE = int(os.getenv("INTENT_CACHE_SIZE", "1000"))
    INTENT_CACHE_TTL_MINUTES = int(os.getenv("INTENT_CACHE_TTL_MINUTES", "60"))
    
    # Response caching settings
    ENABLE_RESPONSE_CACHING = os.getenv("ENABLE_RESPONSE_CACHING", "true").lower() == "true"
    RESPONSE_CACHE_SIZE = int(os.getenv("RESPONSE_CACHE_SIZE", "500"))
    RESPONSE_CACHE_TTL_MINUTES = int(os.getenv("RESPONSE_CACHE_TTL_MINUTES", "30"))
    SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.8"))
    
    # Parallel processing settings
    ENABLE_PARALLEL_PROCESSING = os.getenv("ENABLE_PARALLEL_PROCESSING", "true").lower() == "true"
    MAX_WORKER_THREADS = int(os.getenv("MAX_WORKER_THREADS", "4"))
    
    # Streaming settings
    ENABLE_TRUE_STREAMING = os.getenv("ENABLE_TRUE_STREAMING", "true").lower() == "true"
    STREAMING_CHUNK_SIZE = int(os.getenv("STREAMING_CHUNK_SIZE", "50"))
    STREAMING_DELAY_MS = int(os.getenv("STREAMING_DELAY_MS", "50"))
    
    # Healthcare validation settings
    USE_FAST_HEALTHCARE_CHECK = os.getenv("USE_FAST_HEALTHCARE_CHECK", "true").lower() == "true"
    
    # Database optimization settings
    MESSAGE_HISTORY_CACHE_TTL_MINUTES = int(os.getenv("MESSAGE_HISTORY_CACHE_TTL_MINUTES", "5"))
    MESSAGE_HISTORY_LIMIT = int(os.getenv("MESSAGE_HISTORY_LIMIT", "5"))
    
    # API optimization settings
    HTTP_CONNECTION_POOL_SIZE = int(os.getenv("HTTP_CONNECTION_POOL_SIZE", "100"))
    HTTP_CONNECTION_TIMEOUT_SECONDS = int(os.getenv("HTTP_CONNECTION_TIMEOUT_SECONDS", "30"))
    DNS_CACHE_TTL_SECONDS = int(os.getenv("DNS_CACHE_TTL_SECONDS", "300"))
    
    @classmethod
    def get_all_settings(cls) -> Dict[str, Any]:
        """Get all optimization settings as a dictionary."""
        return {
            "intent_classification": {
                "use_fast_classifier": cls.USE_FAST_INTENT_CLASSIFIER,
                "cache_size": cls.INTENT_CACHE_SIZE,
                "cache_ttl_minutes": cls.INTENT_CACHE_TTL_MINUTES
            },
            "response_caching": {
                "enabled": cls.ENABLE_RESPONSE_CACHING,
                "cache_size": cls.RESPONSE_CACHE_SIZE,
                "cache_ttl_minutes": cls.RESPONSE_CACHE_TTL_MINUTES,
                "similarity_threshold": cls.SIMILARITY_THRESHOLD
            },
            "parallel_processing": {
                "enabled": cls.ENABLE_PARALLEL_PROCESSING,
                "max_worker_threads": cls.MAX_WORKER_THREADS
            },
            "streaming": {
                "true_streaming_enabled": cls.ENABLE_TRUE_STREAMING,
                "chunk_size": cls.STREAMING_CHUNK_SIZE,
                "delay_ms": cls.STREAMING_DELAY_MS
            },
            "healthcare_validation": {
                "use_fast_check": cls.USE_FAST_HEALTHCARE_CHECK
            },
            "database": {
                "message_history_cache_ttl_minutes": cls.MESSAGE_HISTORY_CACHE_TTL_MINUTES,
                "message_history_limit": cls.MESSAGE_HISTORY_LIMIT
            },
            "api": {
                "connection_pool_size": cls.HTTP_CONNECTION_POOL_SIZE,
                "connection_timeout_seconds": cls.HTTP_CONNECTION_TIMEOUT_SECONDS,
                "dns_cache_ttl_seconds": cls.DNS_CACHE_TTL_SECONDS
            }
        }
    
    @classmethod
    def is_optimization_enabled(cls, feature: str) -> bool:
        """Check if a specific optimization feature is enabled."""
        feature_map = {
            "fast_intent": cls.USE_FAST_INTENT_CLASSIFIER,
            "response_cache": cls.ENABLE_RESPONSE_CACHING,
            "parallel_processing": cls.ENABLE_PARALLEL_PROCESSING,
            "true_streaming": cls.ENABLE_TRUE_STREAMING,
            "fast_healthcare_check": cls.USE_FAST_HEALTHCARE_CHECK
        }
        return feature_map.get(feature, False)
    
    @classmethod
    def get_performance_mode(cls) -> str:
        """Get the current performance mode based on enabled optimizations."""
        optimizations_enabled = [
            cls.USE_FAST_INTENT_CLASSIFIER,
            cls.ENABLE_RESPONSE_CACHING,
            cls.ENABLE_PARALLEL_PROCESSING,
            cls.ENABLE_TRUE_STREAMING
        ]
        
        enabled_count = sum(optimizations_enabled)
        
        if enabled_count == 4:
            return "maximum_performance"
        elif enabled_count >= 2:
            return "optimized"
        elif enabled_count == 1:
            return "basic_optimization"
        else:
            return "standard" 