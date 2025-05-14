# SonarCare Agents

This directory contains agent implementations used by the SonarCare application to generate medical advice responses.

## Agent Architecture

SonarCare uses a multi-agent system with specialized agents for different types of medical queries. The system is orchestrated through a LangGraph workflow that:

1. Determines the user's intent using the operator agent
2. Routes the query to a specialized agent based on the intent
3. Processes the query with the appropriate specialized model and prompt
4. Returns a consistent response format

Each agent is optimized for specific types of medical queries and uses the most appropriate Perplexity Sonar model for that task.

## Agents Overview

### Base Agents

- **SonarAgent**: Core integration with the Perplexity Sonar API
- **BaseActionAgent**: Abstract base class for all specialized agents

### Specialized Agents

- **ActionOperatorAgent**: Supervisor agent that classifies user intent to route to other agents
- **ActionGreetingAgent**: Handles greetings and introductions
- **ActionMedicineAgent**: Processes symptom inquiries and treatment advice using a two-step approach
- **ActionMedicalHospitalAgent**: Helps find hospitals and medical facilities
- **ActionMedicalDepartmentAgent**: Provides information on which medical department handles specific conditions
- **ActionDeepMedicalResearchAgent**: Generates comprehensive research information on medical topics
- **ActionFactualUnbiasedAgent**: Provides balanced information on potentially controversial medical topics

## LangGraph Integration

The `langgraph_setup.py` file contains the orchestration logic that:
- Initializes all agents
- Defines the message flow
- Routes messages based on intent
- Manages the conversation state

## Usage

The agent system is accessed through the chat service:

```python
from app.services.chat_service import process_message

# Process a message
response = await process_message(
    text="What are the symptoms of diabetes?",
    session_id="session-123",
    user_id="user-456"
)
```

## Model Selection

Each agent uses the most appropriate Perplexity Sonar model:

- **Operator Agent**: sonar-medium-online
- **Greeting Agent**: sonar-small-online (lightweight)
- **Medicine Agent**: Uses both sonar-medium-online (for search) and sonar-medium-chat (for reasoning)
- **Hospital Agent**: sonar-medium-online
- **Department Agent**: sonar-medium-online
- **Research Agent**: sonar-large-online (for comprehensive research)
- **Unbiased Agent**: sonar-large-online (for balanced information)

## Configuration

The agents use the following environment variables:

- `PERPLEXITY_API_KEY`: Your Perplexity API key (required for production)
- `PERPLEXITY_MODEL`: The default model to use

For development without an API key, the agents fall back to mock implementations that provide basic responses.

## Adding New Agent Types

To add a new type of agent:

1. Create a new file in the `agents` directory that extends `BaseActionAgent`
2. Implement the agent with a similar interface to the existing agents
3. Update the `__init__.py` file to include the new agent
4. Add the agent to the `langgraph_setup.py` file
5. Update the intent detection in the operator agent if needed

## License

This code is part of the SonarCare application and is subject to the same license terms. 