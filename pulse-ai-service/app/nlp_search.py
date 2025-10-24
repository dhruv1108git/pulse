"""
NLP-Powered Incident Search
Uses Gemini to parse natural language queries into Elasticsearch DSL
Showcases: Multi-match, function score, highlighting, fuzzy search
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from elasticsearch import Elasticsearch
from vertexai.generative_models import GenerativeModel
import vertexai
import json

logger = logging.getLogger(__name__)


class NLPSearchService:
    def __init__(self):
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
        
        self.incidents_index = 'pulse-incidents'
        
        logger.info("✅ NLP Search Service initialized")

    def search(
        self,
        query: str,
        user_location: Optional[Dict[str, float]] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Natural language search for incidents
        
        Examples:
        - "fires near me yesterday"
        - "power outages in downtown"
        - "accidents on highway 101"
        - "crime reports last week"
        
        Args:
            query: Natural language query
            user_location: User's location for proximity boost
            limit: Max results
            
        Returns:
            Search results with highlighting and relevance scores
        """
        try:
            # Step 1: Parse intent with LLM
            parsed_query = self._parse_query_intent(query, user_location)
            
            if not parsed_query.get('success'):
                # Fallback to simple search
                return self._simple_search(query, user_location, limit)
            
            # Step 2: Build Elasticsearch query
            es_query = self._build_elastic_query(parsed_query, user_location)
            
            # Step 3: Execute search with highlighting
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    **es_query,
                    "size": limit,
                    "highlight": {
                        "fields": {
                            "title": {
                                "pre_tags": ["<mark>"],
                                "post_tags": ["</mark>"],
                                "number_of_fragments": 0
                            },
                            "description": {
                                "pre_tags": ["<mark>"],
                                "post_tags": ["</mark>"],
                                "fragment_size": 150,
                                "number_of_fragments": 3
                            }
                        }
                    }
                }
            )
            
            # Format results
            results = []
            for hit in response['hits']['hits']:
                source = hit['_source']
                result = {
                    'id': source.get('id'),
                    'type': source.get('report_type'),
                    'title': source.get('title'),
                    'description': source.get('description'),
                    'location': source.get('location'),
                    'timestamp': source.get('timestamp'),
                    'status': source.get('status'),
                    'score': hit['_score'],
                }
                
                # Add highlights if available
                if 'highlight' in hit:
                    result['highlights'] = hit['highlight']
                
                results.append(result)
            
            return {
                'success': True,
                'query': query,
                'parsed_intent': parsed_query.get('intent'),
                'total': response['hits']['total']['value'],
                'results': results,
                'took_ms': response['took']
            }
            
        except Exception as e:
            logger.error(f"Error in NLP search: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }

    def _parse_query_intent(
        self,
        query: str,
        user_location: Optional[Dict[str, float]]
    ) -> Dict:
        """
        Use Gemini to parse natural language query into structured intent
        """
        try:
            system_prompt = """You are an expert at parsing natural language queries for emergency incident search.

Extract the following information from the user's query:
1. incident_type: Type of incident (fire, crime, roadblock, power_outage, medical, accident, other)
2. keywords: Key search terms
3. time_filter: Time range (today, yesterday, last_week, last_month, specific_date, none)
4. location_filter: Location mentioned (specific place name or "near_me")
5. severity: Implied urgency (critical, high, medium, low, none)
6. specific_date: If a specific date is mentioned, extract it

Return JSON format:
{
  "incident_type": "fire",
  "keywords": ["downtown", "building"],
  "time_filter": "yesterday",
  "location_filter": "downtown",
  "severity": "high",
  "fuzzy_search": true
}

Be precise but flexible with synonyms (e.g., "blaze" = fire, "crash" = accident)."""

            user_prompt = f"Parse this search query: \"{query}\""
            if user_location:
                user_prompt += f"\nUser is at: lat={user_location['lat']}, lon={user_location['lon']}"
            
            # Combine system and user prompts
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            # Generate response using Vertex AI
            response = self.llm.generate_content(full_prompt)
            
            # Extract JSON
            response_text = response.text.strip()
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0].strip()
            
            intent = json.loads(response_text)
            
            return {
                'success': True,
                'intent': intent
            }
            
        except Exception as e:
            logger.error(f"Error parsing query intent: {e}")
            return {'success': False, 'error': str(e)}

    def _build_elastic_query(
        self,
        parsed: Dict,
        user_location: Optional[Dict[str, float]]
    ) -> Dict:
        """
        Build complex Elasticsearch query from parsed intent
        
        Demonstrates: multi_match, function_score, time decay, geo decay
        """
        intent = parsed.get('intent', {})
        
        # Base query: multi-match with boosting
        must_clauses = []
        
        # Multi-match on keywords
        keywords = intent.get('keywords', [])
        if keywords:
            # Use best_fields instead of cross_fields to support fuzziness
            must_clauses.append({
                "multi_match": {
                    "query": " ".join(keywords),
                    "fields": [
                        "title^3",           # Title most important
                        "description^2",      # Description second
                        "report_type^1.5"    # Type somewhat important
                    ],
                    "type": "best_fields",
                    "operator": "or",
                    "fuzziness": "AUTO" if intent.get('fuzzy_search', True) else "0"
                }
            })
        
        # Filter by incident type
        filter_clauses = []
        incident_type = intent.get('incident_type')
        if incident_type and incident_type != 'other':
            filter_clauses.append({
                "term": {"report_type": incident_type}
            })
        
        # Time range filter
        time_filter = intent.get('time_filter', 'none')
        if time_filter != 'none':
            time_range = self._get_time_range(time_filter)
            if time_range:
                filter_clauses.append({
                    "range": {
                        "timestamp": time_range
                    }
                })
        
        # Build bool query
        bool_query = {
            "bool": {
                "must": must_clauses if must_clauses else [{"match_all": {}}],
                "filter": filter_clauses
            }
        }
        
        # Wrap in function_score for advanced scoring
        query = {
            "query": {
                "function_score": {
                    "query": bool_query,
                    "functions": []
                }
            }
        }
        
        # Add time decay (recent incidents scored higher)
        query["query"]["function_score"]["functions"].append({
            "exp": {
                "timestamp": {
                    "origin": "now",
                    "scale": "7d",
                    "decay": 0.5
                }
            },
            "weight": 2.0
        })
        
        # Add distance decay if user location available
        if user_location:
            query["query"]["function_score"]["functions"].append({
                "exp": {
                    "location": {
                        "origin": {
                            "lat": user_location['lat'],
                            "lon": user_location['lon']
                        },
                        "scale": "10km",
                        "decay": 0.5
                    }
                },
                "weight": 1.5
            })
        
        # Boost by severity if specified
        severity = intent.get('severity')
        if severity and severity != 'none':
            query["query"]["function_score"]["functions"].append({
                "filter": {
                    "range": {
                        "safety_impact_score": self._get_severity_range(severity)
                    }
                },
                "weight": 1.5
            })
        
        query["query"]["function_score"]["boost_mode"] = "multiply"
        query["query"]["function_score"]["score_mode"] = "sum"
        
        return query

    def _get_time_range(self, time_filter: str) -> Optional[Dict]:
        """Convert time filter to Elasticsearch range"""
        now = datetime.utcnow()
        
        ranges = {
            'today': {'gte': 'now/d'},
            'yesterday': {'gte': 'now-1d/d', 'lt': 'now/d'},
            'last_week': {'gte': 'now-7d/d'},
            'last_month': {'gte': 'now-30d/d'},
        }
        
        return ranges.get(time_filter)

    def _get_severity_range(self, severity: str) -> Dict:
        """Convert severity to score range"""
        ranges = {
            'critical': {'gte': 8},
            'high': {'gte': 6, 'lt': 8},
            'medium': {'gte': 4, 'lt': 6},
            'low': {'lt': 4}
        }
        
        return ranges.get(severity, {'gte': 0})

    def _simple_search(
        self,
        query: str,
        user_location: Optional[Dict[str, float]],
        limit: int
    ) -> Dict:
        """Fallback simple search"""
        try:
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "description^2", "report_type"],
                            "fuzziness": "AUTO"
                        }
                    },
                    "size": limit
                }
            )
            
            results = []
            for hit in response['hits']['hits']:
                results.append({
                    **hit['_source'],
                    'score': hit['_score']
                })
            
            return {
                'success': True,
                'query': query,
                'total': response['hits']['total']['value'],
                'results': results,
                'fallback': True
            }
            
        except Exception as e:
            logger.error(f"Error in simple search: {e}")
            return {'success': False, 'error': str(e), 'results': []}

    def get_suggestions(self, prefix: str, limit: int = 5) -> List[str]:
        """
        Get autocomplete suggestions
        
        Note: Requires completion field in mapping
        """
        try:
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "suggest": {
                        "incident-suggest": {
                            "prefix": prefix,
                            "completion": {
                                "field": "title.completion",
                                "size": limit,
                                "skip_duplicates": True
                            }
                        }
                    }
                }
            )
            
            suggestions = []
            for option in response['suggest']['incident-suggest'][0]['options']:
                suggestions.append(option['text'])
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error getting suggestions: {e}")
            return []


# Global instance
_nlp_search_service = None

def get_nlp_search_service() -> NLPSearchService:
    """Get or create NLP search service instance"""
    global _nlp_search_service
    if _nlp_search_service is None:
        _nlp_search_service = NLPSearchService()
    return _nlp_search_service

