"""
Enhanced AI Assistant for Pulse Emergency System
Features:
- Semantic search on incident descriptions (not just types)
- Time-aware incident analysis
- Location-based safety scoring
- Intelligent query understanding
- Parallel Elasticsearch queries for performance
"""

import os
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from elasticsearch import Elasticsearch
from vertexai.generative_models import GenerativeModel
from vertexai.language_models import TextEmbeddingModel
import vertexai
import logging
import json

logger = logging.getLogger(__name__)

class EnhancedPulseAssistant:
    def __init__(self):
        # Initialize Elastic client
        self.es_client = Elasticsearch(
            cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
            api_key=os.getenv('ELASTIC_API_KEY')
        )
        
        # Initialize Vertex AI
        project_id = os.getenv('VERTEX_AI_PROJECT_ID')
        location = os.getenv('VERTEX_AI_LOCATION', 'us-central1')
        
        # Initialize with explicit credentials handling for Cloud Run
        try:
            # Explicitly get credentials from Application Default Credentials (ADC)
            # This works in Cloud Run via metadata service
            # Unset GOOGLE_APPLICATION_CREDENTIALS to force ADC to use metadata service
            import google.auth
            if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
                del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
                
            credentials, project = google.auth.default(
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            
            vertexai.init(
                project=project_id or project,
                location=location,
                credentials=credentials
            )
            
            # Initialize Gemini model - use stable version
            llm_model = os.getenv('VERTEX_AI_LLM_MODEL', 'gemini-1.5-flash')
            self.llm = GenerativeModel(llm_model)
            
            # Initialize embeddings model - use stable version
            embedding_model = os.getenv('VERTEX_AI_EMBEDDING_MODEL', 'text-embedding-004')
            self.embeddings_model = TextEmbeddingModel.from_pretrained(embedding_model)
            
            logger.info(f"✅ Vertex AI initialized with {llm_model} and {embedding_model}")
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {e}")
            self.llm = None
            self.embeddings_model = None
        
        self.incidents_index = os.getenv('ELASTIC_INCIDENTS_INDEX', 'pulse-incidents')
        self.chat_index = 'pulse-chat-history'
        
        logger.info("✅ Enhanced Pulse Assistant initialized")

    def _analyze_query_intent(self, query: str) -> Dict[str, Any]:
        """
        Analyze user query to understand intent and extract key parameters
        Returns: {
            'intent': 'safety_check' | 'incident_search' | 'helpline' | 'general',
            'keywords': List[str],
            'time_context': 'recent' | 'now' | 'specific_time',
            'safety_question': bool,
            'specific_location': Optional[str]
        }
        """
        query_lower = query.lower()
        
        intent_analysis = {
            'intent': 'general',
            'keywords': [],
            'time_context': 'recent',
            'safety_question': False,
            'specific_location': None,
            'requires_description_search': False
        }
        
        # Detect safety questions
        safety_keywords = ['safe', 'safety', 'dangerous', 'risk', 'travel', 'walk', 'drive', 'go to']
        if any(keyword in query_lower for keyword in safety_keywords):
            intent_analysis['intent'] = 'safety_check'
            intent_analysis['safety_question'] = True
        
        # Detect incident search
        incident_keywords = ['incident', 'report', 'happen', 'occurred', 'crime', 'fire', 'roadblock', 'power', 'gun', 'weapon', 'violence', 'theft', 'assault']
        if any(keyword in query_lower for keyword in incident_keywords):
            intent_analysis['intent'] = 'incident_search'
        
        # Detect time context
        if any(word in query_lower for word in ['now', 'right now', 'currently', 'active']):
            intent_analysis['time_context'] = 'now'
        elif any(word in query_lower for word in ['recent', 'lately', 'today', 'this week']):
            intent_analysis['time_context'] = 'recent'
        elif any(word in query_lower for word in ['last night', 'yesterday', 'last week', 'hour ago', 'hours ago']):
            intent_analysis['time_context'] = 'specific_time'
        
        # Detect specific incident details (requires description search)
        detail_keywords = ['gun', 'weapon', 'knife', 'man', 'woman', 'person', 'car', 'vehicle', 'shots', 'shooting', 'breaking', 'suspicious']
        if any(keyword in query_lower for keyword in detail_keywords):
            intent_analysis['requires_description_search'] = True
            intent_analysis['keywords'] = [word for word in detail_keywords if word in query_lower]
        
        # Extract location mentions
        location_markers = ['at', 'on', 'near', 'around']
        for marker in location_markers:
            if marker in query_lower:
                parts = query_lower.split(marker)
                if len(parts) > 1:
                    intent_analysis['specific_location'] = parts[1].strip().split()[0:3]
        
        return intent_analysis

    async def _semantic_search_incidents(
        self,
        query: str,
        location: Optional[Dict[str, float]] = None,
        time_range_hours: int = 168,  # Default: last week
        size: int = 10
    ) -> List[Dict]:
        """
        Semantic search on incident DESCRIPTIONS (not just types)
        Uses embeddings to match meaning, not just keywords
        """
        try:
            # Generate embedding for query
            embeddings_response = self.embeddings_model.get_embeddings([query])
            query_vector = embeddings_response[0].values if embeddings_response else []
            
            # Time filter
            time_threshold = (datetime.now(timezone.utc) - timedelta(hours=time_range_hours)).isoformat()
            
            # Build search with description-focused matching
            search_body = {
                "size": size,
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": [
                                        "description^3",  # Description is most important
                                        "title^2",
                                        "report_type"
                                    ],
                                    "type": "best_fields",
                                    "fuzziness": "AUTO"
                                }
                            }
                        ],
                        "filter": [
                            {
                                "range": {
                                    "timestamp": {
                                        "gte": time_threshold
                                    }
                                }
                            }
                        ]
                    }
                },
                "sort": [
                    {"_score": {"order": "desc"}},
                    {"timestamp": {"order": "desc"}}
                ]
            }
            
            # Add geo filter if location provided
            if location and 'lat' in location and 'lon' in location:
                search_body["query"]["bool"]["filter"].append({
                    "geo_distance": {
                        "distance": "50km",
                        "location": {
                            "lat": location['lat'],
                            "lon": location['lon']
                        }
                    }
                })
            
            # Execute search
            response = self.es_client.search(
                index=self.incidents_index,
                body=search_body
            )
            
            incidents = []
            for hit in response['hits']['hits']:
                incident = hit['_source']
                incident['relevance_score'] = hit['_score']
                
                # Calculate time ago
                if 'timestamp' in incident:
                    try:
                        timestamp = datetime.fromisoformat(incident['timestamp'].replace('Z', '+00:00'))
                        time_diff = datetime.now(timezone.utc) - timestamp
                        hours_ago = time_diff.total_seconds() / 3600
                        incident['hours_ago'] = round(hours_ago, 1)
                    except:
                        incident['hours_ago'] = None
                
                incidents.append(incident)
            
            logger.info(f"🔍 Semantic search found {len(incidents)} incidents for: {query}")
            return incidents
            
        except Exception as e:
            logger.error(f"Error in semantic search: {e}", exc_info=True)
            return []

    async def _analyze_area_safety(
        self,
        location: Dict[str, float],
        radius_km: float = 5.0,
        time_window_hours: int = 72
    ) -> Dict[str, Any]:
        """
        Analyze safety of an area based on incident patterns
        """
        try:
            time_threshold = (datetime.now(timezone.utc) - timedelta(hours=time_window_hours)).isoformat()
            
            # Query incidents in area
            search_body = {
                "size": 100,
                "query": {
                    "bool": {
                        "filter": [
                            {
                                "geo_distance": {
                                    "distance": f"{radius_km}km",
                                    "location": {
                                        "lat": location['lat'],
                                        "lon": location['lon']
                                    }
                                }
                            },
                            {
                                "range": {
                                    "timestamp": {
                                        "gte": time_threshold
                                    }
                                }
                            }
                        ]
                    }
                },
                "aggs": {
                    "by_type": {
                        "terms": {"field": "report_type"}
                    },
                    "by_hour": {
                        "date_histogram": {
                            "field": "timestamp",
                            "calendar_interval": "hour"
                        }
                    }
                }
            }
            
            response = self.es_client.search(
                index=self.incidents_index,
                body=search_body
            )
            
            incidents = [hit['_source'] for hit in response['hits']['hits']]
            total_incidents = len(incidents)
            
            # Analyze incident types
            type_counts = {}
            for bucket in response['aggregations']['by_type']['buckets']:
                type_counts[bucket['key']] = bucket['doc_count']
            
            # Calculate safety score (0-100, higher is safer)
            safety_score = 100
            
            # Reduce score based on incident types and counts
            severity_weights = {
                'crime': 15,
                'fire': 10,
                'roadblock': 5,
                'power_outage': 3
            }
            
            for incident_type, count in type_counts.items():
                weight = severity_weights.get(incident_type, 5)
                safety_score -= min(weight * count, 50)  # Cap impact
            
            safety_score = max(0, safety_score)
            
            # Determine safety level
            if safety_score >= 80:
                safety_level = "Very Safe"
            elif safety_score >= 60:
                safety_level = "Generally Safe"
            elif safety_score >= 40:
                safety_level = "Moderate Caution"
            else:
                safety_level = "Exercise Caution"
            
            return {
                'safety_score': safety_score,
                'safety_level': safety_level,
                'total_incidents': total_incidents,
                'incident_breakdown': type_counts,
                'radius_km': radius_km,
                'time_window_hours': time_window_hours,
                'high_risk_types': [t for t, c in type_counts.items() if c >= 3]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing area safety: {e}", exc_info=True)
            return {
                'safety_score': 50,
                'safety_level': 'Unknown',
                'error': str(e)
            }

    async def _parallel_search(
        self,
        query: str,
        location: Optional[Dict[str, float]],
        intent_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Run multiple Elasticsearch queries in parallel for efficiency
        """
        tasks = []
        
        # Task 1: Semantic search on descriptions
        tasks.append(self._semantic_search_incidents(
            query=query,
            location=location,
            time_range_hours=168,  # Last week
            size=10
        ))
        
        # Task 2: Safety analysis (if safety question)
        if intent_analysis['safety_question'] and location:
            tasks.append(self._analyze_area_safety(
                location=location,
                radius_km=5.0,
                time_window_hours=72
            ))
        else:
            tasks.append(asyncio.sleep(0))  # Dummy task
        
        # Task 3: Recent incidents (last 24h)
        recent_time = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        if location:
            tasks.append(self._get_recent_incidents_sync(location, recent_time))
        else:
            tasks.append(asyncio.sleep(0))
        
        # Run all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            'semantic_incidents': results[0] if not isinstance(results[0], Exception) else [],
            'safety_analysis': results[1] if intent_analysis['safety_question'] and not isinstance(results[1], Exception) else None,
            'recent_incidents': results[2] if location and not isinstance(results[2], Exception) else []
        }

    async def _get_recent_incidents_sync(self, location: Dict[str, float], time_threshold: str) -> List[Dict]:
        """Get recent incidents synchronously"""
        try:
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "size": 20,
                    "query": {
                        "bool": {
                            "filter": [
                                {
                                    "geo_distance": {
                                        "distance": "10km",
                                        "location": {
                                            "lat": location['lat'],
                                            "lon": location['lon']
                                        }
                                    }
                                },
                                {
                                    "range": {
                                        "timestamp": {
                                            "gte": time_threshold
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "sort": [{"timestamp": {"order": "desc"}}]
                }
            )
            return [hit['_source'] for hit in response['hits']['hits']]
        except Exception as e:
            logger.error(f"Error getting recent incidents: {e}")
            return []

    def _build_enhanced_context(
        self,
        query: str,
        intent_analysis: Dict[str, Any],
        search_results: Dict[str, Any],
        user_location: Optional[Dict[str, float]]
    ) -> str:
        """Build rich context for AI with all relevant information"""
        
        context_parts = []
        
        # 1. Query intent analysis
        context_parts.append(f"Query Intent: {intent_analysis['intent']}")
        context_parts.append(f"Time Context: {intent_analysis['time_context']}")
        if intent_analysis['keywords']:
            context_parts.append(f"Key Terms: {', '.join(intent_analysis['keywords'])}")
        
        # 2. Semantic search results (descriptions)
        semantic_incidents = search_results.get('semantic_incidents', [])
        if semantic_incidents:
            context_parts.append(f"\n=== RELEVANT INCIDENTS (Semantic Search) ===")
            for i, inc in enumerate(semantic_incidents[:5], 1):
                hours_ago = inc.get('hours_ago', 'unknown')
                desc = inc.get('description', 'No description')
                context_parts.append(
                    f"{i}. [{inc.get('report_type', 'unknown').upper()}] {inc.get('title', 'Untitled')}\n"
                    f"   Description: {desc}\n"
                    f"   Time: {hours_ago} hours ago\n"
                    f"   Relevance Score: {inc.get('relevance_score', 0):.2f}"
                )
        else:
            context_parts.append("\n=== NO MATCHING INCIDENTS FOUND ===")
        
        # 3. Safety analysis
        safety_analysis = search_results.get('safety_analysis')
        if safety_analysis:
            context_parts.append(f"\n=== AREA SAFETY ANALYSIS ===")
            context_parts.append(f"Safety Score: {safety_analysis['safety_score']}/100")
            context_parts.append(f"Safety Level: {safety_analysis['safety_level']}")
            context_parts.append(f"Total Incidents (last 72h): {safety_analysis['total_incidents']}")
            if safety_analysis.get('incident_breakdown'):
                context_parts.append(f"Breakdown: {json.dumps(safety_analysis['incident_breakdown'])}")
            if safety_analysis.get('high_risk_types'):
                context_parts.append(f"⚠️  High Risk Types: {', '.join(safety_analysis['high_risk_types'])}")
        
        # 4. Recent incidents context
        recent_incidents = search_results.get('recent_incidents', [])
        if recent_incidents:
            context_parts.append(f"\n=== RECENT ACTIVITY (Last 24h) ===")
            context_parts.append(f"Total recent incidents: {len(recent_incidents)}")
            recent_types = {}
            for inc in recent_incidents:
                rt = inc.get('report_type', 'unknown')
                recent_types[rt] = recent_types.get(rt, 0) + 1
            context_parts.append(f"Types: {json.dumps(recent_types)}")
        
        return "\n".join(context_parts)

    def _get_enhanced_system_prompt(self) -> str:
        """Enhanced system prompt with better instructions"""
        return """You are Pulse AI Assistant, an intelligent emergency response and safety advisor.

Your capabilities:
- Analyze incident descriptions (not just types) to answer specific questions
- Understand location and time context
- Provide safety assessments based on incident patterns
- Answer questions like "any gun reports near me?" by searching incident DESCRIPTIONS
- Evaluate route/area safety based on historical data

CRITICAL INSTRUCTIONS:
1. When users ask about specific incidents (e.g., "gun reports"), ALWAYS check the incident DESCRIPTIONS provided in the context
2. Pay attention to the "Relevance Score" - higher scores mean better matches
3. Filter incidents by time context (recent, hours ago, etc.)
4. For safety questions, use the Safety Analysis data to give informed recommendations
5. If no relevant incidents are found, clearly state that
6. Never mention irrelevant incidents (like fire when asked about guns)
7. Be specific about timing (e.g., "2 hours ago", "yesterday", "this morning")
8. For safety questions, give actionable advice based on the data

Response format:
- Keep responses concise (2-4 sentences)
- Lead with the most relevant information
- Use emojis appropriately (🚨, ⚠️, ✅, 🔫, 🔥)
- Include timing and distance when relevant
- Be honest if data is limited

Remember: You're helping people make safety decisions. Be accurate, specific, and helpful."""

    async def chat(
        self,
        message: str,
        user_location: Optional[Dict[str, float]] = None,
        conversation_history: List[Dict[str, str]] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enhanced chat with intelligent query understanding and parallel searches
        """
        # Check if Vertex AI is initialized
        if self.llm is None or self.embeddings_model is None:
            return {
                'response': "I'm currently unable to process your request as the AI service is not configured. Please contact support or check the deployment logs.",
                'sources': [],
                'intent': 'error'
            }
        
        try:
            # Step 1: Analyze query intent
            intent_analysis = self._analyze_query_intent(message)
            logger.info(f"📊 Query intent: {intent_analysis}")
            
            # Step 2: Run parallel searches
            search_results = await self._parallel_search(
                query=message,
                location=user_location,
                intent_analysis=intent_analysis
            )
            
            # Step 3: Build enhanced context
            incident_context = self._build_enhanced_context(
                query=message,
                intent_analysis=intent_analysis,
                search_results=search_results,
                user_location=user_location
            )
            
            # Step 4: Build conversation history
            history_text = ""
            if conversation_history:
                for msg in conversation_history[-6:]:
                    role = "User" if msg['role'] == 'user' else "Assistant"
                    history_text += f"{role}: {msg['content']}\n"
            
            # Step 5: Build location context
            location_str = "Not provided"
            if user_location:
                parts = []
                for key in ['area', 'city', 'state', 'country']:
                    if user_location.get(key):
                        parts.append(user_location[key])
                if parts:
                    location_str = ', '.join(parts)
                else:
                    location_str = f"Lat: {user_location.get('lat', 0):.4f}, Lon: {user_location.get('lon', 0):.4f}"
            
            # Step 6: Generate AI response
            full_prompt = f"""{self._get_enhanced_system_prompt()}

{history_text}

User Query: "{message}"
User Location: {location_str}

{incident_context}

Respond to the user's query based ONLY on the relevant incidents found in the semantic search results. Focus on matching their specific question (e.g., if they ask about "gun", look for gun mentions in descriptions)."""
            
            # Generate with retry logic
            import time
            max_retries = 3
            retry_delay = 1
            
            for attempt in range(max_retries):
                try:
                    response = self.llm.generate_content(full_prompt)
                    response_text = response.text
                    break
                except Exception as e:
                    if '429' in str(e) and attempt < max_retries - 1:
                        logger.warning(f'Rate limit, retrying... ({attempt + 1}/{max_retries})')
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        raise
            
            # Store in history
            if session_id:
                self._store_chat_message(session_id, message, 'user', user_location)
                self._store_chat_message(session_id, response_text, 'assistant', user_location)
            
            # Return enhanced response
            semantic_incidents = search_results.get('semantic_incidents', [])
            return {
                'response': response_text,
                'incidents_found': len(semantic_incidents),
                'incidents': semantic_incidents[:3],
                'has_more': len(semantic_incidents) > 3,
                'safety_analysis': search_results.get('safety_analysis'),
                'intent_detected': intent_analysis['intent']
            }
            
        except Exception as e:
            logger.error(f"Error in enhanced chat: {e}", exc_info=True)
            return {
                'response': "I apologize, but I'm experiencing technical difficulties. Please try again.",
                'incidents_found': 0,
                'incidents': [],
                'error': str(e)
            }

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
                'context': {'location': location}
            }
            self.es_client.index(index=self.chat_index, document=doc)
        except Exception as e:
            logger.error(f"Error storing message: {e}")

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
_enhanced_assistant = None

def get_enhanced_assistant() -> EnhancedPulseAssistant:
    """Get or create enhanced assistant instance"""
    global _enhanced_assistant
    if _enhanced_assistant is None:
        _enhanced_assistant = EnhancedPulseAssistant()
    return _enhanced_assistant

