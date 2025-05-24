import logging
import asyncio
from typing import Dict, Any, List, TypedDict, Literal, AsyncGenerator
import uuid
from datetime import datetime

# Import our agents
from app.agents.action_operator_agent import ActionOperatorAgent
from app.agents.action_greeting_agent import ActionGreetingAgent
from app.agents.action_medicine_agent import ActionMedicineAgent
from app.agents.action_medical_hospital_agent import ActionMedicalHospitalAgent
from app.agents.action_medical_department_agent import ActionMedicalDepartmentAgent
from app.agents.action_deep_medical_research_agent import ActionDeepMedicalResearchAgent
from app.agents.action_factual_unbiased_agent import ActionFactualUnbiasedAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define types for our state
class ChatMessage(TypedDict):
    id: str
    text: str
    sender: Literal["user", "bot"]
    sessionId: str
    userId: str
    timestamp: str
    metadata: Dict[str, Any]

class ChatState(TypedDict):
    messages: List[ChatMessage]
    current_intent: str
    session_id: str
    user_id: str
    current_query: str
    response: str
    response_metadata: Dict[str, Any]

# Initialize the agents (lazy loading for better performance)
_agents = {}

def get_agent(agent_type: str):
    """Lazy load agents to improve startup time."""
    if agent_type not in _agents:
        if agent_type == "operator":
            _agents[agent_type] = ActionOperatorAgent()
        elif agent_type == "greeting":
            _agents[agent_type] = ActionGreetingAgent()
        elif agent_type == "medicine":
            _agents[agent_type] = ActionMedicineAgent()
        elif agent_type == "hospital":
            _agents[agent_type] = ActionMedicalHospitalAgent()
        elif agent_type == "department":
            _agents[agent_type] = ActionMedicalDepartmentAgent()
        elif agent_type == "research":
            _agents[agent_type] = ActionDeepMedicalResearchAgent()
        elif agent_type == "unbiased":
            _agents[agent_type] = ActionFactualUnbiasedAgent()
    
    return _agents.get(agent_type)

async def process_with_langgraph(query: str, session_id: str, user_id: str, message_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process a message through the LangGraph workflow (non-streaming version for compatibility).
    
    Args:
        query: The user's query text
        session_id: The chat session ID
        user_id: The user's ID
        message_history: List of previous messages
        
    Returns:
        Dict containing the bot's response
    """
    # Check healthcare context first
    if not await _is_healthcare_related(query):
        # Return rejection message for non-medical queries
        return {
            "id": str(uuid.uuid4()),
            "text": "I'm a medical advice chatbot specialized in healthcare and medical topics. I can only help you with health-related questions, symptoms, treatments, medical procedures, finding doctors or hospitals, and other medical concerns.\n\nPlease ask me something related to health or medicine, and I'll be happy to help you!",
            "sender": "bot",
            "sessionId": session_id,
            "userId": user_id,
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "intent": "non_medical_query",
                "rejected": True
            }
        }
    
    # Get the final result from streaming
    final_result = None
    async for chunk in process_with_langgraph_streaming(query, session_id, user_id, message_history):
        if chunk["type"] == "end":
            final_result = chunk.get("message")
    
    return final_result

async def process_with_langgraph_streaming(
    query: str, 
    session_id: str, 
    user_id: str, 
    message_history: List[Dict[str, Any]]
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process a message through the optimized LangGraph workflow with streaming support.
    
    Args:
        query: The user's query text
        session_id: The chat session ID
        user_id: The user's ID
        message_history: List of previous messages
        
    Yields:
        Dict containing streaming response chunks
    """
    start_time = datetime.now()
    
    # Create state
    state = {
        "messages": message_history,
        "current_intent": "",
        "session_id": session_id,
        "user_id": user_id,
        "current_query": query,
        "response": "",
        "response_metadata": {}
    }
    
    try:
        # Step 0: Healthcare context validation
        yield {
            "type": "status",
            "data": "Validating your question...",
            "done": False
        }
        
        if not await _is_healthcare_related(query):
            # Create a polite rejection message
            rejection_message = {
                "id": str(uuid.uuid4()),
                "text": "I'm a medical advice chatbot specialized in healthcare and medical topics. I can only help you with health-related questions, symptoms, treatments, medical procedures, finding doctors or hospitals, and other medical concerns.\n\nPlease ask me something related to health or medicine, and I'll be happy to help you!",
                "sender": "bot",
                "sessionId": session_id,
                "userId": user_id,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "intent": "non_medical_query",
                    "rejected": True,
                    "processing_time_seconds": (datetime.now() - start_time).total_seconds()
                }
            }
            
            yield {
                "type": "start",
                "data": "",
                "done": False,
                "metadata": {"intent": "non_medical_query", "rejected": True}
            }
            
            yield {
                "type": "end",
                "data": rejection_message["text"],
                "done": True,
                "message": rejection_message
            }
            return
        
        # Step 1: Determine the intent using the optimized operator agent
        yield {
            "type": "status",
            "data": "Analyzing your question...",
            "done": False
        }
        
        operator_agent = get_agent("operator")
        intent, intent_metadata = await operator_agent.process(query, message_history)
        state["current_intent"] = intent
        
        intent_time = datetime.now()
        logger.info(f"Intent '{intent}' detected in {(intent_time - start_time).total_seconds():.2f}s")
        
        # Step 2: Route to the appropriate agent based on intent
        yield {
            "type": "status", 
            "data": "Generating response...",
            "done": False
        }
        
        # Start streaming the actual response
        response_agent = _get_response_agent(intent)
        
        if hasattr(response_agent, 'generate_streaming_response'):
            # Use streaming if available
            async for chunk in response_agent.generate_streaming_response(query, message_history):
                if chunk["type"] == "start":
                    yield {
                        "type": "start",
                        "data": "",
                        "done": False,
                        "metadata": {**chunk.get("metadata", {}), "intent": intent, **intent_metadata}
                    }
                elif chunk["type"] == "chunk":
                    yield {
                        "type": "chunk",
                        "data": chunk["data"],
                        "done": False
                    }
                elif chunk["type"] == "end":
                    # Create final bot message
                    processing_time = (datetime.now() - start_time).total_seconds()
                    
                    bot_message = {
                        "id": str(uuid.uuid4()),
                        "text": chunk["data"],
                        "sender": "bot",
                        "sessionId": session_id,
                        "userId": user_id,
                        "timestamp": datetime.now().isoformat(),
                        "metadata": {
                            **chunk.get("metadata", {}),
                            "intent": intent,
                            "processing_time_seconds": processing_time,
                            **intent_metadata
                        }
                    }
                    
                    yield {
                        "type": "end",
                        "data": chunk["data"],
                        "done": True,
                        "message": bot_message
                    }
        else:
            # Fallback to non-streaming response
            response, metadata = await response_agent.process(query, message_history)
            
            # Simulate streaming by chunking the response
            yield {
                "type": "start",
                "data": "",
                "done": False,
                "metadata": {**metadata, "intent": intent, **intent_metadata}
            }
            
            # Break response into chunks for streaming effect
            words = response.split()
            current_text = ""
            
            for i, word in enumerate(words):
                current_text += word + " "
                
                # Yield chunk every few words or at sentence boundaries
                if i % 5 == 0 or word.endswith('.') or word.endswith('!') or word.endswith('?'):
                    yield {
                        "type": "chunk",
                        "data": current_text.strip(),
                        "done": False
                    }
                    # Small delay for streaming effect
                    await asyncio.sleep(0.03)
            
            # Create final bot message
            processing_time = (datetime.now() - start_time).total_seconds()
            
            bot_message = {
                "id": str(uuid.uuid4()),
                "text": response,
                "sender": "bot",
                "sessionId": session_id,
                "userId": user_id,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    **metadata,
                    "intent": intent,
                    "processing_time_seconds": processing_time,
                    **intent_metadata
                }
            }
            
            yield {
                "type": "end",
                "data": response,
                "done": True,
                "message": bot_message
            }
    
    except Exception as e:
        logger.error(f"Error in LangGraph processing: {str(e)}")
        yield {
            "type": "error",
            "data": "I'm sorry, I encountered an error while processing your request. Please try again.",
            "done": True,
            "metadata": {"error": str(e)}
        }

def _get_response_agent(intent: str):
    """Get the appropriate agent based on the detected intent."""
    agent_mapping = {
        "greeting": "greeting",
        "symptom_inquiry": "medicine",
        "treatment_advice": "medicine", 
        "hospital_search": "hospital",
        "department_inquiry": "department",
        "deep_medical_inquiry": "research",
        "unbiased_factual_request": "unbiased",
        "unknown": "medicine"  # Default to medicine agent
    }
    
    agent_type = agent_mapping.get(intent, "medicine")
    return get_agent(agent_type)

async def _is_healthcare_related(query: str) -> bool:
    """
    Determine if a query is related to healthcare/medical topics.
    Uses both keyword detection and LLM validation for accuracy.
    
    Args:
        query: The user's query text
        
    Returns:
        bool: True if healthcare-related, False otherwise
    """
    # First, check for obvious healthcare keywords (fast path)
    healthcare_keywords = [
        # General medical terms
        "health", "medical", "medicine", "doctor", "physician", "nurse", "hospital", "clinic",
        "patient", "treatment", "therapy", "diagnosis", "symptom", "disease", "illness", "condition",
        "prescription", "medication", "drug", "pill", "tablet", "injection", "vaccine",
        
        # Body parts and systems
        "heart", "lung", "brain", "stomach", "liver", "kidney", "blood", "bone", "muscle",
        "skin", "eye", "ear", "nose", "throat", "chest", "back", "head", "neck", "arm", "leg",
        
        # Common symptoms
        "pain", "ache", "fever", "cough", "cold", "flu", "headache", "nausea", "vomiting",
        "diarrhea", "constipation", "fatigue", "tired", "dizzy", "swelling", "rash", "infection",
        
        # Medical procedures
        "surgery", "operation", "scan", "x-ray", "mri", "ct", "ultrasound", "blood test",
        "checkup", "examination", "biopsy", "endoscopy",
        
        # Medical specialties
        "cardiology", "neurology", "dermatology", "oncology", "psychiatry", "pediatrics",
        "gynecology", "orthopedics", "ophthalmology", "radiology", "pathology",
        
        # Common questions
        "hurt", "sick", "unwell", "feel", "feeling", "what should i do", "is it normal",
        "how to treat", "side effects", "allergic", "emergency", "urgent"
    ]
    
    query_lower = query.lower()
    
    # Quick keyword check
    if any(keyword in query_lower for keyword in healthcare_keywords):
        return True
    
    # Check for obvious non-medical topics (fast rejection)
    non_medical_keywords = [
        # Technology
        "programming", "coding", "software", "computer", "website", "app", "algorithm",
        "database", "api", "javascript", "python", "java", "html", "css",
        
        # Entertainment
        "movie", "film", "music", "song", "game", "gaming", "video", "youtube", "netflix",
        "spotify", "entertainment", "celebrity", "actor", "actress",
        
        # Sports
        "football", "soccer", "basketball", "baseball", "tennis", "golf", "swimming",
        "running", "gym", "workout", "exercise", "sports", "team", "player",
        
        # Business/Finance
        "business", "money", "finance", "investment", "stock", "trading", "marketing",
        "sales", "profit", "revenue", "company", "startup", "entrepreneur",
        
        # Education (non-medical)
        "math", "mathematics", "physics", "chemistry", "history", "geography", "literature",
        "language", "spanish", "french", "english", "homework", "assignment",
        
        # General topics
        "weather", "travel", "food", "cooking", "recipe", "restaurant", "politics",
        "government", "news", "current events", "philosophy", "religion"
    ]
    
    # Quick non-medical check
    if any(keyword in query_lower for keyword in non_medical_keywords):
        # If it contains non-medical keywords but no medical keywords, likely not medical
        return False
    
    # For ambiguous cases, use LLM validation
    try:
        from app.agents.base_agent import BaseActionAgent
        
        # Create a simple prompt for healthcare validation
        validation_prompt = f"""Is the following question related to healthcare, medicine, medical advice, symptoms, treatments, doctors, hospitals, or any health-related topics?

Question: "{query}"

Answer with only "YES" or "NO"."""
        
        # Use a simple agent for validation
        agent = BaseActionAgent()
        response, _ = await agent._generate_response(validation_prompt)
        
        # Parse the response
        response_clean = response.strip().upper()
        return response_clean.startswith("YES")
        
    except Exception as e:
        logger.warning(f"Error in LLM healthcare validation: {str(e)}")
        # If LLM fails, be conservative and allow the query
        return True