import logging
from typing import Dict, Any, List, TypedDict, Annotated, Literal, Union
import uuid
from datetime import datetime

from langchain_core.messages import HumanMessage, AIMessage

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

# Initialize the agents
operator_agent = ActionOperatorAgent()
greeting_agent = ActionGreetingAgent()
medicine_agent = ActionMedicineAgent()
hospital_agent = ActionMedicalHospitalAgent()
department_agent = ActionMedicalDepartmentAgent()
research_agent = ActionDeepMedicalResearchAgent()
unbiased_agent = ActionFactualUnbiasedAgent()

async def process_with_langgraph(query: str, session_id: str, user_id: str, message_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process a message through the LangGraph workflow.
    
    Args:
        query: The user's query text
        session_id: The chat session ID
        user_id: The user's ID
        message_history: List of previous messages
        
    Returns:
        Dict containing the bot's response
    """
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
    
    # Step 1: Determine the intent using the operator agent
    intent, intent_metadata = await operator_agent.process(query, message_history)
    state["current_intent"] = intent
    logger.info(f"Detected intent: {intent}")
    
    # Step 2: Route to the appropriate agent based on intent
    response = ""
    metadata = {}
    
    if intent == "greeting":
        response, metadata = await greeting_agent.process(query, message_history)
    
    elif intent in ["symptom_inquiry", "treatment_advice"]:
        response, metadata = await medicine_agent.process(query, message_history)
    
    elif intent == "hospital_search":
        response, metadata = await hospital_agent.process(query, message_history)
    
    elif intent == "department_inquiry":
        response, metadata = await department_agent.process(query, message_history)
    
    elif intent == "deep_medical_inquiry":
        response, metadata = await research_agent.process(query, message_history)
    
    elif intent == "unbiased_factual_request":
        response, metadata = await unbiased_agent.process(query, message_history)
    
    else:  # "unknown" or any unhandled intent
        # Fall back to the medicine agent as a safe default
        response, metadata = await medicine_agent.process(query, message_history)
    
    # Update state with the response
    state["response"] = response
    state["response_metadata"] = metadata
    
    # Create the bot message
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
            **intent_metadata
        }
    }
    
    return bot_message 