"""
Pulse AI Service - Main Flask Application
Analyzes incidents using Vertex AI and Elastic hybrid search
"""

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from elastic_client import ElasticClient
from vertex_ai import VertexAIClient
from dispatch import analyze_incident, generate_alert
from assistant import get_assistant
from assistant_enhanced import get_enhanced_assistant
from helplines import get_helplines_service
from helplines_enhanced import get_enhanced_helplines_service
from web_search import get_web_search_service
from nlp_search import get_nlp_search_service
from insights import get_insights_service
from twilio_dispatcher import get_twilio_dispatcher

# Configure logging first (before loading env)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from root .env (only in development/local)
# In production (Cloud Run), environment variables come from Cloud Run config
root_dir = Path(__file__).parent.parent.parent
env_path = root_dir / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    logger.info(f'Loaded .env from {env_path}')
else:
    logger.info('No .env file found (using Cloud Run environment variables)')

# Initialize Flask app
app = Flask(__name__)

# Configure CORS to allow requests from your Firebase Hosting domain
# and localhost for development.
CORS(app, resources={r"/api/*": {
    "origins": [
        "http://localhost:3000",
        "http://localhost:8081",
        "https://mlops-474023.web.app",
        "https://mlops-474023.firebaseapp.com"
    ]
}})

# Initialize clients
elastic_client = None
vertex_ai_client = None

try:
    elastic_client = ElasticClient(
        cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
        api_key=os.getenv('ELASTIC_API_KEY')
    )
    logger.info('Elastic client initialized')
except Exception as e:
    logger.error(f'Failed to initialize Elastic client: {e}')

try:
    vertex_ai_client = VertexAIClient(
        project_id=os.getenv('VERTEX_AI_PROJECT_ID'),
        location=os.getenv('VERTEX_AI_LOCATION', 'us-central1')
    )
    logger.info('Vertex AI client initialized')
except Exception as e:
    logger.error(f'Failed to initialize Vertex AI client: {e}')


@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({
        'name': 'Pulse AI Service',
        'version': '1.0.0',
        'description': 'AI-powered incident analysis with Vertex AI and Elastic',
        'status': 'running',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'elastic_connected': elastic_client is not None,
        'vertex_ai_configured': vertex_ai_client is not None,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })


@app.route('/api/incidents/store', methods=['POST'])
def store_incident():
    """
    Store an incident directly in Elasticsearch
    
    Expected payload:
    {
        "report_id": "uuid",
        "report_type": "fire|crime|roadblock|power_outage",
        "title": "...",
        "description": "...",
        "location": {"lat": 12.34, "lon": 56.78},
        "severity": 1-5,
        "timestamp": "ISO 8601 timestamp",
        "device_id": "...",
        "status": "local|broadcasting|synced"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['report_id', 'report_type', 'location']
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        # Add @timestamp for Elasticsearch if not provided
        if '@timestamp' not in data:
            data['@timestamp'] = data.get('timestamp', datetime.now(timezone.utc).isoformat())
        
        # Generate embedding for the incident (for semantic search)
        if vertex_ai_client:
            try:
                query_text = f"{data.get('title', '')} {data.get('description', '')} {data.get('report_type', '')}"
                embedding = vertex_ai_client.generate_embedding(query_text)
                if embedding:
                    data['text_embedding'] = embedding
            except Exception as e:
                logger.warning(f"Failed to generate embedding: {e}")
        
        # Store in Elasticsearch
        if elastic_client:
            doc_id = elastic_client.store_incident(data)
            logger.info(f"Stored incident {data['report_id']} with doc_id {doc_id}")
            
            return jsonify({
                'success': True,
                'report_id': data['report_id'],
                'doc_id': doc_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
        else:
            return jsonify({'error': 'Elasticsearch client not available'}), 503
        
    except Exception as e:
        logger.error(f'Error storing incident: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to store incident',
            'message': str(e)
        }), 500


@app.route('/api/incidents/stats', methods=['GET'])
def incidents_stats():
    """
    Get incident statistics including total count
    """
    try:
        if not elastic_client:
            return jsonify({'error': 'Elasticsearch client not available'}), 503
        
        # Get total count from Elasticsearch
        result = elastic_client.client.count(index=elastic_client.incidents_index)
        total_count = result.get('count', 0)
        
        return jsonify({
            'success': True,
            'total_count': total_count,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error fetching incident stats: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to fetch stats',
            'message': str(e)
        }), 500


@app.route('/api/incidents/list', methods=['GET'])
def list_incidents():
    """
    List recent incidents from Elasticsearch
    
    Query params:
        limit: Max number of incidents (default: 200)
    """
    try:
        if not elastic_client:
            return jsonify({'error': 'Elasticsearch client not available'}), 503

        limit = request.args.get('limit', 200, type=int)
        limit = max(1, min(limit, 1000))

        incidents = elastic_client.list_recent_incidents(size=limit)

        return jsonify({
            'success': True,
            'count': len(incidents),
            'incidents': incidents,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f'Error listing incidents: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to list incidents',
            'message': str(e)
        }), 500


@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Analyze an incident using Elastic hybrid search and Vertex AI
    
    Expected payload:
    {
        "report_id": "uuid",
        "report_type": "fire|crime|roadblock|power_outage",
        "title": "...",
        "description": "...",
        "location": {"lat": 12.34, "lon": 56.78}
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['report_id', 'report_type', 'location']
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        # Analyze incident
        analysis_result = analyze_incident(
            data,
            elastic_client,
            vertex_ai_client,
            logger
        )
        
        return jsonify({
            'success': True,
            'report_id': data['report_id'],
            'analysis': analysis_result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error analyzing incident: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to analyze incident',
            'message': str(e)
        }), 500


@app.route('/api/dispatch', methods=['POST'])
def dispatch_alert():
    """
    Generate and dispatch alert for critical incidents
    
    Expected payload:
    {
        "report_id": "uuid",
        "analysis": {...},
        "priority": "low|medium|high|critical"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Generate alert
        alert = generate_alert(
            data,
            vertex_ai_client,
            logger
        )
        
        # Log to Elastic dispatch log
        if elastic_client:
            try:
                elastic_client.log_dispatch_action({
                    '@timestamp': datetime.now(timezone.utc).isoformat(),
                    'report_id': data.get('report_id'),
                    'action': 'alert_generated',
                    'alert': alert,
                    'priority': data.get('priority', 'medium')
                })
            except Exception as e:
                logger.error(f'Failed to log dispatch action: {e}')
        
        return jsonify({
            'success': True,
            'report_id': data.get('report_id'),
            'alert': alert,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error generating dispatch alert: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to generate alert',
            'message': str(e)
        }), 500


@app.route('/api/assistant/chat', methods=['POST'])
def assistant_chat():
    """
    AI Assistant chat endpoint
    
    Expected payload:
    {
        "message": "user message",
        "location": {"lat": 12.34, "lon": 56.78},  // optional
        "session_id": "session-uuid",  // optional
        "conversation_history": [...]  // optional
    }
    """
    import asyncio
    
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        assistant = get_assistant()
        
        # Run async chat method synchronously
        result = asyncio.run(assistant.chat(
            message=data['message'],
            user_location=data.get('location'),
            conversation_history=data.get('conversation_history', []),
            session_id=data.get('session_id')
        ))
        
        return jsonify({
            'success': True,
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error in assistant chat: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to process chat',
            'message': str(e)
        }), 500


@app.route('/api/assistant/chat/enhanced', methods=['POST'])
def assistant_chat_enhanced():
    """
    Enhanced AI Assistant with semantic search on descriptions, safety analysis, and intelligent query understanding
    
    Expected payload:
    {
        "message": "user message",
        "location": {"lat": 12.34, "lon": 56.78, "city": "San Francisco", "state": "CA"},  // optional
        "session_id": "session-uuid",  // optional
        "conversation_history": [...]  // optional
    }
    
    Features:
    - Semantic search on incident DESCRIPTIONS (not just types)
    - Understands queries like "any gun reports near me?" by searching descriptions
    - Time-aware filtering (recent vs old incidents)
    - Safety analysis for "is it safe to travel X street?" questions
    - Parallel Elasticsearch queries for performance
    """
    import asyncio
    
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        assistant = get_enhanced_assistant()
        
        # Run async chat method synchronously
        result = asyncio.run(assistant.chat(
            message=data['message'],
            user_location=data.get('location'),
            conversation_history=data.get('conversation_history', []),
            session_id=data.get('session_id')
        ))
        
        return jsonify({
            'success': True,
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error in enhanced assistant chat: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to process enhanced chat',
            'message': str(e)
        }), 500


@app.route('/api/relay/query', methods=['POST'])
def relay_query():
    """
    Process a relayed query (assistant or SOS)
    Handles deduplication via Elasticsearch
    
    Expected payload:
    {
        "query_id": "unique-id",
        "query_text": "...",
        "query_type": "assistant" | "sos",
        "user_location": {"lat": float, "lon": float},
        "original_device": "device-id",
        "relayed_by": "device-id",
        "sos_data": {...}  // optional, for SOS queries
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        query_id = data.get('query_id')
        query_text = data.get('query_text')
        query_type = data.get('query_type')
        user_location = data.get('user_location', {})
        original_device = data.get('original_device')
        relayed_by = data.get('relayed_by', 'direct')
        
        if not all([query_id, query_type, original_device]):
            return jsonify({'error': 'Missing required fields: query_id, query_type, original_device'}), 400
        
        # Check if query already processed
        if elastic_client:
            existing = elastic_client.get_relay_query(query_id)
            if existing and existing.get('status') == 'completed':
                logger.info(f'Query {query_id} already completed, returning cached response')
                return jsonify({
                    'success': True,
                    'query_id': query_id,
                    'status': 'completed',
                    'response': existing.get('response'),
                    'cached': True,
                    'timestamp': existing.get('completed_at')
                })
            
            # Mark as processing
            if existing and existing.get('status') == 'pending':
                elastic_client.mark_query_processing(query_id, relayed_by)
        
        # Process based on query type
        if query_type == 'assistant':
            # Process AI assistant query
            response_text = handle_assistant_query(
                query_id=query_id,
                query_text=query_text,
                user_location=user_location,
                original_device=original_device,
                relayed_by=relayed_by
            )
            
            return jsonify({
                'success': True,
                'query_id': query_id,
                'status': 'completed',
                'response': response_text,
                'cached': False,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
        elif query_type == 'sos':
            # Process SOS emergency
            sos_data = data.get('sos_data', {})
            result = handle_sos(
                query_id=query_id,
                sos_data=sos_data,
                user_location=user_location,
                original_device=original_device,
                relayed_by=relayed_by
            )
            
            return jsonify(result)
        
        else:
            return jsonify({'error': f'Unknown query_type: {query_type}'}), 400
        
    except Exception as e:
        logger.error(f'Error processing relay query: {e}', exc_info=True)
        if elastic_client and query_id:
            elastic_client.mark_query_failed(query_id, str(e))
        return jsonify({
            'error': 'Failed to process relay query',
            'message': str(e)
        }), 500


@app.route('/api/relay/check', methods=['GET'])
def check_relay_query():
    """
    Check status of a relay query
    
    Query params:
        query_id: Unique query identifier (required)
    """
    try:
        query_id = request.args.get('query_id')
        
        if not query_id:
            return jsonify({'error': 'query_id is required'}), 400
        
        if not elastic_client:
            return jsonify({'error': 'Elasticsearch not available'}), 503
        
        query_doc = elastic_client.get_relay_query(query_id)
        
        if not query_doc:
            return jsonify({
                'success': False,
                'query_id': query_id,
                'status': 'not_found'
            }), 404
        
        response_data = {
            'success': True,
            'query_id': query_id,
            'status': query_doc.get('status'),
            'query_type': query_doc.get('query_type'),
            'timestamp': query_doc.get('timestamp')
        }
        
        if query_doc.get('status') == 'completed':
            response_data['response'] = query_doc.get('response')
            response_data['completed_at'] = query_doc.get('completed_at')
        
        if query_doc.get('status') == 'failed':
            response_data['error_message'] = query_doc.get('error_message')
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f'Error checking relay query: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to check query status',
            'message': str(e)
        }), 500


def handle_assistant_query(
    query_id: str,
    query_text: str,
    user_location: dict,
    original_device: str,
    relayed_by: str
) -> str:
    """Handle AI assistant query with ENHANCED assistant (semantic search, safety analysis, time-aware)"""
    import asyncio
    
    try:
        # Store query in Elasticsearch
        if elastic_client:
            query_data = {
                'query_id': query_id,
                'query_text': query_text,
                'query_type': 'assistant',
                'status': 'processing',
                'user_location': user_location,
                'original_device': original_device,
                'relayed_by': relayed_by,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            elastic_client.store_relay_query(query_data)
        
        # Process with ENHANCED assistant
        assistant = get_enhanced_assistant()
        session_id = f"relay-{query_id}"
        
        result = asyncio.run(assistant.chat(
            message=query_text,
            user_location=user_location,
            session_id=session_id
        ))
        
        response_text = result.get('response', 'Sorry, I could not process your request.')
        
        # Mark as completed
        if elastic_client:
            elastic_client.mark_query_completed(
                query_id=query_id,
                response_data=response_text,
                relayed_by=relayed_by
            )
        
        logger.info(f'Assistant query {query_id} completed successfully')
        return response_text
        
    except Exception as e:
        logger.error(f'Error handling assistant query: {e}', exc_info=True)
        if elastic_client:
            elastic_client.mark_query_failed(query_id, str(e))
        raise


def handle_sos(
    query_id: str,
    sos_data: dict,
    user_location: dict,
    original_device: str,
    relayed_by: str
) -> dict:
    """Handle SOS emergency with Twilio dispatch"""
    try:
        incident_type = sos_data.get('incident_type', 'emergency')
        description = sos_data.get('description', 'Emergency SOS')
        user_name = sos_data.get('user_name', 'Unknown')
        
        logger.info(f'Processing SOS {query_id}: type={incident_type}, location={user_location}')
        
        # Analyze severity - Default to critical for all SOS emergencies
        severity = 'critical'
        
        # Store in Elasticsearch
        if elastic_client:
            query_data = {
                'query_id': query_id,
                'query_text': f'SOS: {incident_type}',
                'query_type': 'sos',
                'status': 'processing',
                'user_location': user_location,
                'severity': severity,
                'emergency_type': incident_type,
                'original_device': original_device,
                'relayed_by': relayed_by,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            elastic_client.store_relay_query(query_data)
            
            # Also store as incident (without severity field - index expects different type)
            incident_data = {
                'report_id': query_id,
                'report_type': incident_type,
                'title': f'SOS Emergency: {incident_type}',
                'description': description,
                'location': user_location,
                '@timestamp': datetime.now(timezone.utc).isoformat()
            }
            elastic_client.store_incident(incident_data)
        
        # Send SMS via Twilio
        twilio_dispatcher = get_twilio_dispatcher()
        address_str = f"{user_location.get('lat', 0):.6f}, {user_location.get('lon', 0):.6f}"
        
        sms_result = twilio_dispatcher.send_emergency_sms(
            incident_type=incident_type,
            severity=severity,
            location=user_location,
            address=address_str,
            additional_info=f"User: {user_name}, Description: {description}"
        )
        
        # Mark as completed
        response_text = f"SOS emergency dispatched successfully. Emergency services notified. Type: {incident_type}, Severity: {severity}."
        if not sms_result.get('success'):
            response_text = f"SOS logged but SMS dispatch failed: {sms_result.get('error')}"
        
        if elastic_client:
            elastic_client.mark_query_completed(
                query_id=query_id,
                response_data=response_text,
                relayed_by=relayed_by,
                sms_dispatch=sms_result
            )
        
        logger.info(f'SOS {query_id} processed successfully')
        
        return {
            'success': True,
            'query_id': query_id,
            'status': 'completed',
            'response': response_text,
            'severity': severity,
            'emergency_type': incident_type,
            'sms_dispatch': sms_result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f'Error handling SOS: {e}', exc_info=True)
        if elastic_client:
            elastic_client.mark_query_failed(query_id, str(e))
        raise


@app.route('/api/helplines/nearby', methods=['GET'])
def get_nearby_helplines():
    """
    Get emergency helplines for a location
    
    Query params:
        lat: Latitude (required)
        lon: Longitude (required)
        distance: Search radius, e.g., "50km" (optional, default: "100km")
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        distance = request.args.get('distance', '100km')
        
        if lat is None or lon is None:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        helplines_service = get_helplines_service()
        result = helplines_service.get_nearby_helplines(lat, lon, distance)
        
        return jsonify({
            'success': True,
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting helplines: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get helplines',
            'message': str(e)
        }), 500


@app.route('/api/assistant/history/<session_id>', methods=['GET'])
def get_conversation_history(session_id):
    """Get conversation history for a session"""
    try:
        limit = request.args.get('limit', 20, type=int)
        
        assistant = get_assistant()
        history = assistant.get_conversation_history(session_id, limit)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'messages': history,
            'count': len(history),
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting conversation history: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get conversation history',
            'message': str(e)
        }), 500


@app.route('/api/helplines/smart', methods=['GET'])
def get_smart_helplines():
    """
    Get emergency helplines using web search + LLM (with caching)
    
    Query params:
        location: Location name (e.g., "San Francisco, CA")
        lat: Latitude (optional)
        lon: Longitude (optional)
        force_refresh: Force web search even if cached (optional)
    """
    try:
        location = request.args.get('location')
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        
        if not location:
            return jsonify({'error': 'Location parameter is required'}), 400
        
        enhanced_service = get_enhanced_helplines_service()
        result = enhanced_service.get_helplines(location, lat, lon, force_refresh)
        
        return jsonify({
            'success': result.get('success', True),
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting smart helplines: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get helplines',
            'message': str(e)
        }), 500


@app.route('/api/helplines/cache/stats', methods=['GET'])
def get_cache_stats():
    """Get helplines cache statistics"""
    try:
        enhanced_service = get_enhanced_helplines_service()
        stats = enhanced_service.get_cache_stats()
        
        return jsonify({
            'success': True,
            'stats': stats,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting cache stats: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get cache stats',
            'message': str(e)
        }), 500


@app.route('/api/helplines/cache/clear', methods=['POST'])
def clear_expired_cache():
    """Clear expired cache entries"""
    try:
        enhanced_service = get_enhanced_helplines_service()
        result = enhanced_service.clear_expired_cache()
        
        return jsonify({
            'success': result.get('success', True),
            'deleted': result.get('deleted', 0),
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error clearing cache: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to clear cache',
            'message': str(e)
        }), 500


@app.route('/api/incidents/nlp-search', methods=['GET'])
def nlp_search_incidents():
    """
    Natural language search for incidents
    
    Query params:
        q: Search query (e.g., "fires near me yesterday")
        lat: User latitude (optional)
        lon: User longitude (optional)
        limit: Max results (default: 20)
    """
    try:
        query = request.args.get('q', '')
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        limit = request.args.get('limit', 20, type=int)
        
        if not query:
            return jsonify({'error': 'Query parameter "q" is required'}), 400
        
        user_location = None
        if lat is not None and lon is not None:
            user_location = {'lat': lat, 'lon': lon}
        
        nlp_service = get_nlp_search_service()
        results = nlp_service.search(query, user_location, limit)
        
        return jsonify({
            'success': results.get('success', True),
            'data': results,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error in NLP search: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to search incidents',
            'message': str(e)
        }), 500


@app.route('/api/incidents/suggestions', methods=['GET'])
def get_search_suggestions():
    """
    Get autocomplete suggestions for search
    
    Query params:
        prefix: Search prefix
        limit: Max suggestions (default: 5)
    """
    try:
        prefix = request.args.get('prefix', '')
        limit = request.args.get('limit', 5, type=int)
        
        if not prefix:
            return jsonify({'suggestions': []})
        
        nlp_service = get_nlp_search_service()
        suggestions = nlp_service.get_suggestions(prefix, limit)
        
        return jsonify({
            'success': True,
            'suggestions': suggestions,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting suggestions: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get suggestions',
            'message': str(e)
        }), 500


@app.route('/api/insights/safety-score', methods=['GET'])
def get_safety_score():
    """
    Get safety score for an area
    
    Query params:
        lat: Latitude (optional)
        lon: Longitude (optional)
        radius: Search radius (default: 10km)
        time_range: Time window (default: 7d)
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', '10km')
        time_range = request.args.get('time_range', '7d')
        
        location = None
        if lat is not None and lon is not None:
            location = {'lat': lat, 'lon': lon}
        
        insights_service = get_insights_service()
        result = insights_service.get_safety_score(location, radius, time_range)
        
        return jsonify({
            'success': result.get('success', True),
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting safety score: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get safety score',
            'message': str(e)
        }), 500


@app.route('/api/insights/trends', methods=['GET'])
def get_trends():
    """
    Get incident trends over time
    
    Query params:
        interval: Time bucket size (default: 1h)
        time_range: How far back (default: 24h)
        lat: Latitude (optional)
        lon: Longitude (optional)
        radius: Search radius (default: 50km)
    """
    try:
        interval = request.args.get('interval', '1h')
        time_range = request.args.get('time_range', '24h')
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', '50km')
        
        location = None
        if lat is not None and lon is not None:
            location = {'lat': lat, 'lon': lon}
        
        insights_service = get_insights_service()
        result = insights_service.get_trends(interval, time_range, location, radius)
        
        return jsonify({
            'success': result.get('success', True),
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting trends: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get trends',
            'message': str(e)
        }), 500


@app.route('/api/insights/hotspots', methods=['GET'])
def get_hotspots():
    """
    Get incident hotspots
    
    Query params:
        precision: Geohash precision 1-12 (default: 5)
        time_range: Time window (default: 7d)
        min_incidents: Min incidents for hotspot (default: 2)
    """
    try:
        precision = request.args.get('precision', 5, type=int)
        time_range = request.args.get('time_range', '7d')
        min_incidents = request.args.get('min_incidents', 2, type=int)
        
        insights_service = get_insights_service()
        result = insights_service.get_hotspots(precision, time_range, min_incidents)
        
        return jsonify({
            'success': result.get('success', True),
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting hotspots: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get hotspots',
            'message': str(e)
        }), 500


@app.route('/api/insights/summary', methods=['GET'])
def get_summary():
    """Get overall system statistics"""
    try:
        insights_service = get_insights_service()
        result = insights_service.get_summary_stats()
        
        return jsonify({
            'success': result.get('success', True),
            'data': result,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f'Error getting summary: {e}', exc_info=True)
        return jsonify({
            'error': 'Failed to get summary',
            'message': str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    logger.error(f'Internal server error: {error}')
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Cloud Run sets PORT, but allow AI_SERVICE_PORT for compatibility
    port = int(os.getenv('PORT', os.getenv('AI_SERVICE_PORT', '5001')))
    debug = os.getenv('NODE_ENV') == 'development' or os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f'Starting Pulse AI Service on port {port}')
    logger.info(f'Debug mode: {debug}')
    logger.info(f'Environment: {"Production" if not debug else "Development"}')
    
    app.run(host='0.0.0.0', port=port, debug=debug)


