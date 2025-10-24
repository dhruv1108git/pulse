"""
AI Assistant for Pulse Emergency System
Uses Gemini + Elastic hybrid search for conversational incident queries
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from elasticsearch import Elasticsearch
import google.cloud.aiplatform as aiplatform
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel
from vertexai.language_models import TextEmbeddingModel
import vertexai
import logging

logger = logging.getLogger(__name__)

class PulseAssistant:
    def __init__(self):
        # Initialize Elastic client
        self.es_client = Elasticsearch(
            cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
            api_key=os.getenv('ELASTIC_API_KEY')
        )
        
        # Initialize Vertex AI
        project_id = os.getenv('VERTEX_AI_PROJECT_ID')
        location = os.getenv('VERTEX_AI_LOCATION', 'us-central1')
        vertexai.init(project=project_id, location=location)
        
        # Initialize Gemini model
        self.llm = GenerativeModel("gemini-2.0-flash-exp")
        
        # Initialize embeddings model
        self.embeddings_model = TextEmbeddingModel.from_pretrained("text-embedding-005")
        
        self.incidents_index = os.getenv('ELASTIC_INCIDENTS_INDEX', 'pulse-incidents')
        self.chat_index = 'pulse-chat-history'
        
        logger.info("✅ Pulse Assistant initialized")

    def _hybrid_search_incidents(
        self, 
        query: str, 
        location: Optional[Dict[str, float]] = None,
        filters: Optional[Dict] = None,
        size: int = 5
    ) -> List[Dict]:
        """
        Perform hybrid search: BM25 (keyword) + kNN (vector) on incidents
        """
        try:
            # Generate query embedding using Vertex AI
            embeddings_response = self.embeddings_model.get_embeddings([query])
            query_vector = embeddings_response[0].values if embeddings_response else []
            
            # Build the search query - use simple BM25 search
            # Vector search requires text_embedding field which may not exist for all incidents
            search_body: Dict[str, Any] = {
                "size": size,
                "query": {
                    "bool": {
                        "must": [
                            # BM25 keyword search
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": ["title^2", "description", "report_type"],
                                    "type": "best_fields"
                                }
                            }
                        ]
                    }
                }
            }
            
            # Add location filter if provided
            if location and 'lat' in location and 'lon' in location:
                search_body["query"]["bool"]["filter"] = [{
                    "geo_distance": {
                        "distance": "50km",
                        "location": {
                            "lat": location['lat'],
                            "lon": location['lon']
                        }
                    }
                }]
            
            # Add vector search if embedding exists
            if query_vector and len(query_vector) > 0:
                try:
                    # Check if any documents have text_embedding field
                    # If not, skip vector search to avoid errors
                    search_body["query"]["bool"]["should"] = [
                        {
                            "script_score": {
                                "query": {"match_all": {}},
                                "script": {
                                    "source": """
                                        if (doc.containsKey('text_embedding') && !doc['text_embedding'].empty) {
                                            return cosineSimilarity(params.query_vector, 'text_embedding') + 1.0;
                                        } else {
                                            return 1.0;
                                        }
                                    """,
                                    "params": {"query_vector": query_vector}
                                },
                                "boost": 1.5
                            }
                        }
                    ]
                except Exception as e:
                    logger.warning(f"Vector search unavailable: {e}")
            
            # Execute search
            response = self.es_client.search(
                index=self.incidents_index,
                body=search_body
            )
            
            # Extract and return results
            hits = response['hits']['hits']
            incidents = [
                {
                    **hit['_source'],
                    'relevance_score': hit['_score']
                }
                for hit in hits
            ]
            
            logger.info(f"Found {len(incidents)} incidents for query: {query}")
            return incidents
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            return []

    def _get_system_prompt(self) -> str:
        """Get the system prompt for the AI assistant"""
        return """You are Pulse AI Assistant, an intelligent emergency response helper.

Your role:
- Help users understand emergency situations in their area
- Provide clear, concise information about incidents
- Offer safety recommendations based on incident data
- Be empathetic and professional in emergency situations
- When users ask about incidents, use the search results provided
- If no incidents are found, reassure the user their area seems safe
- Provide emergency helpline numbers when relevant

Guidelines:
- Keep responses concise (2-4 sentences unless asked for details)
- Always prioritize safety in your recommendations
- If multiple similar incidents exist, highlight patterns
- Use emojis sparingly and appropriately (🚨, 🔥, 🌊, etc.)
- If you don't have specific information, say so honestly
- Format location-based answers with distances when available

Remember: You're assisting in real emergency situations. Be helpful, accurate, and supportive."""

    async def chat(
        self,
        message: str,
        user_location: Optional[Dict[str, float]] = None,
        conversation_history: List[Dict[str, str]] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a chat message and generate AI response
        
        Args:
            message: User's message
            user_location: User's current location {lat, lon}
            conversation_history: Previous messages
            session_id: Session ID for tracking
            
        Returns:
            Dict with response and context
        """
        try:
            # Search for relevant incidents
            incidents = self._hybrid_search_incidents(
                query=message,
                location=user_location,
                size=5
            )
            
            # Build context from incidents
            incident_context = self._format_incidents_context(incidents)
            
            # Build conversation history text
            history_text = ""
            if conversation_history:
                for msg in conversation_history[-6:]:  # Last 3 exchanges
                    role = "User" if msg['role'] == 'user' else "Assistant"
                    history_text += f"{role}: {msg['content']}\n\n"
            
            # Build location string with area/city if available
            location_str = "Not provided"
            if user_location:
                location_parts = []
                if user_location.get('area'):
                    location_parts.append(user_location['area'])
                if user_location.get('city'):
                    location_parts.append(user_location['city'])
                if user_location.get('state'):
                    location_parts.append(user_location['state'])
                
                if location_parts:
                    location_str = f"{', '.join(location_parts)} (Lat: {user_location.get('lat', 0):.4f}, Lon: {user_location.get('lon', 0):.4f})"
                else:
                    location_str = f"Lat: {user_location.get('lat', 0):.4f}, Lon: {user_location.get('lon', 0):.4f}"
            
            # Build full prompt
            full_prompt = f"""{self._get_system_prompt()}

{history_text}

User query: {message}

Relevant incidents found:
{incident_context}

User location: {location_str}

Please provide a helpful response based on the incidents data. When referring to the user's location, use the area/city name if available."""
            
            # Generate response using Vertex AI with retry logic
            import time
            max_retries = 3
            retry_delay = 1  # seconds
            
            for attempt in range(max_retries):
                try:
                    response = self.llm.generate_content(full_prompt)
                    response_text = response.text
                    break  # Success, exit retry loop
                except Exception as e:
                    if '429' in str(e) and attempt < max_retries - 1:
                        logger.warning(f'Rate limit hit (429), retrying in {retry_delay}s... (attempt {attempt + 1}/{max_retries})')
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        raise  # Re-raise if not 429 or last attempt
            
            # Store in chat history
            if session_id:
                self._store_chat_message(session_id, message, 'user', user_location)
                self._store_chat_message(session_id, response_text, 'assistant', user_location)
            
            return {
                'response': response_text,
                'incidents_found': len(incidents),
                'incidents': incidents[:3],  # Top 3 for display
                'has_more': len(incidents) > 3
            }
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return {
                'response': "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
                'incidents_found': 0,
                'incidents': [],
                'error': str(e)
            }

    def _format_incidents_context(self, incidents: List[Dict]) -> str:
        """Format incidents for context"""
        if not incidents:
            return "No recent incidents found in the area."
        
        context_lines = []
        for i, incident in enumerate(incidents[:5], 1):
            line = f"{i}. {incident.get('title', 'Unknown')} ({incident.get('report_type', 'unknown')})"
            if 'location' in incident:
                line += f" - Location: {incident['location']}"
            if 'timestamp' in incident:
                line += f" - When: {incident['timestamp']}"
            context_lines.append(line)
        
        return "\n".join(context_lines)

    def _store_chat_message(
        self, 
        session_id: str, 
        message: str, 
        role: str,
        location: Optional[Dict[str, float]] = None
    ):
        """Store chat message in Elasticsearch"""
        try:
            doc = {
                'session_id': session_id,
                'message': message,
                'role': role,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'context': {
                    'location': location
                }
            }
            self.es_client.index(index=self.chat_index, document=doc)
        except Exception as e:
            logger.error(f"Error storing chat message: {e}")

    def get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict]:
        """Retrieve conversation history"""
        try:
            response = self.es_client.search(
                index=self.chat_index,
                body={
                    "query": {"term": {"session_id": session_id}},
                    "sort": [{"timestamp": "asc"}],
                    "size": limit
                }
            )
            return [hit['_source'] for hit in response['hits']['hits']]
        except Exception as e:
            logger.error(f"Error retrieving history: {e}")
            return []


# Global instance
_assistant = None

def get_assistant() -> PulseAssistant:
    """Get or create assistant instance"""
    global _assistant
    if _assistant is None:
        _assistant = PulseAssistant()
    return _assistant

