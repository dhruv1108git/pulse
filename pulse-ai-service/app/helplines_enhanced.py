"""
Enhanced Helplines Service with Web Search + LLM + Elastic Caching
Demonstrates: TTL, Index Lifecycle Management, Dynamic Data
"""

import os
from typing import Dict, Optional
from datetime import datetime, timedelta
from elasticsearch import Elasticsearch
import logging
from web_search import get_web_search_service

logger = logging.getLogger(__name__)

class EnhancedHelplinesService:
    def __init__(self):
        self.es_client = Elasticsearch(
            cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
            api_key=os.getenv('ELASTIC_API_KEY')
        )
        self.helplines_cache_index = 'pulse-helplines-cache'
        self.web_search = get_web_search_service()
        
        # Cache TTL: 30 days
        self.cache_ttl_days = 30
        
        logger.info("✅ Enhanced Helplines Service initialized")

    def get_helplines(
        self,
        location_name: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        force_refresh: bool = False
    ) -> Dict:
        """
        Get emergency helplines for a location
        1. Check Elasticsearch cache (30-day TTL)
        2. If expired/missing, perform web search
        3. Extract with LLM
        4. Cache results
        
        Args:
            location_name: City/area name
            lat: Latitude (optional)
            lon: Longitude (optional)
            force_refresh: Force web search even if cached
            
        Returns:
            Helpline data with sources and confidence
        """
        try:
            # Step 1: Check cache (unless force refresh)
            if not force_refresh:
                cached_data = self._get_from_cache(location_name)
                if cached_data:
                    logger.info(f"Cache HIT for {location_name}")
                    return {
                        'success': True,
                        'location': location_name,
                        'data': cached_data,
                        'from_cache': True,
                        'cached_at': cached_data.get('cached_at'),
                        'expires_at': cached_data.get('expires_at')
                    }
            
            logger.info(f"Cache MISS for {location_name}, performing web search...")
            
            # Step 2: Perform web search
            search_results = self.web_search.search_emergency_contacts(location_name)
            
            if not search_results.get('success') or not search_results.get('results'):
                return {
                    'success': False,
                    'error': 'No search results found',
                    'location': location_name,
                    'from_cache': False
                }
            
            # Step 3: Extract structured data with LLM
            extraction = self.web_search.extract_contacts_with_llm(
                search_results['results'],
                location_name
            )
            
            if not extraction.get('success'):
                return {
                    'success': False,
                    'error': 'Failed to extract contact information',
                    'location': location_name,
                    'from_cache': False
                }
            
            # Step 4: Cache the results
            helpline_data = extraction['data']
            helpline_data['location_name'] = location_name
            if lat and lon:
                helpline_data['coordinates'] = {'lat': lat, 'lon': lon}
            
            self._save_to_cache(location_name, helpline_data, lat, lon)
            
            return {
                'success': True,
                'location': location_name,
                'data': helpline_data,
                'from_cache': False,
                'search_performed': True,
                'sources_checked': helpline_data.get('sources_checked', 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting helplines: {e}")
            return {
                'success': False,
                'error': str(e),
                'location': location_name,
                'data': {
                    'emergency': '911',
                    'contacts': [],
                    'fallback': '911'
                }
            }

    def _get_from_cache(self, location_name: str) -> Optional[Dict]:
        """
        Check if helplines are cached and not expired
        
        Demonstrates: Elasticsearch as cache with TTL
        """
        try:
            # Search for exact location match
            response = self.es_client.search(
                index=self.helplines_cache_index,
                body={
                    "query": {
                        "bool": {
                            "must": [
                                {"term": {"location_name.keyword": location_name}},
                                {"range": {"expires_at": {"gte": "now"}}}  # Not expired
                            ]
                        }
                    },
                    "size": 1,
                    "sort": [{"cached_at": "desc"}]  # Most recent first
                }
            )
            
            if response['hits']['hits']:
                hit = response['hits']['hits'][0]
                return hit['_source']
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking cache: {e}")
            return None

    def _save_to_cache(
        self,
        location_name: str,
        helpline_data: Dict,
        lat: Optional[float] = None,
        lon: Optional[float] = None
    ):
        """
        Save helplines to cache with expiration date
        
        Demonstrates: Index Lifecycle Management, TTL
        """
        try:
            now = datetime.utcnow()
            expires_at = now + timedelta(days=self.cache_ttl_days)
            
            doc = {
                'location_name': location_name,
                'emergency': helpline_data.get('emergency', '911'),
                'contacts': helpline_data.get('contacts', []),
                'fallback': helpline_data.get('fallback', '911'),
                'sources_checked': helpline_data.get('sources_checked', 0),
                'cached_at': now.isoformat(),
                'expires_at': expires_at.isoformat(),
                'ttl_days': self.cache_ttl_days
            }
            
            if lat and lon:
                doc['location'] = {'lat': lat, 'lon': lon}
            
            # Index the document
            self.es_client.index(
                index=self.helplines_cache_index,
                document=doc
            )
            
            logger.info(f"Cached helplines for {location_name} (expires: {expires_at.date()})")
            
        except Exception as e:
            logger.error(f"Error saving to cache: {e}")

    def clear_expired_cache(self):
        """
        Delete expired cache entries
        
        Demonstrates: Index cleanup, date range queries
        """
        try:
            response = self.es_client.delete_by_query(
                index=self.helplines_cache_index,
                body={
                    "query": {
                        "range": {
                            "expires_at": {"lt": "now"}
                        }
                    }
                }
            )
            
            deleted_count = response.get('deleted', 0)
            logger.info(f"Cleared {deleted_count} expired cache entries")
            
            return {'success': True, 'deleted': deleted_count}
            
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return {'success': False, 'error': str(e)}

    def get_cache_stats(self) -> Dict:
        """
        Get statistics about the helplines cache
        
        Demonstrates: Aggregations for monitoring
        """
        try:
            response = self.es_client.search(
                index=self.helplines_cache_index,
                body={
                    "size": 0,
                    "aggs": {
                        "total_cached": {
                            "value_count": {"field": "location_name.keyword"}
                        },
                        "active_cache": {
                            "filter": {
                                "range": {"expires_at": {"gte": "now"}}
                            }
                        },
                        "expired_cache": {
                            "filter": {
                                "range": {"expires_at": {"lt": "now"}}
                            }
                        },
                        "avg_sources": {
                            "avg": {"field": "sources_checked"}
                        }
                    }
                }
            )
            
            aggs = response['aggregations']
            
            return {
                'total_locations': aggs['total_cached']['value'],
                'active': aggs['active_cache']['doc_count'],
                'expired': aggs['expired_cache']['doc_count'],
                'avg_sources_checked': round(aggs['avg_sources']['value'], 2) if aggs['avg_sources']['value'] else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {}


# Global instance
_enhanced_helplines_service = None

def get_enhanced_helplines_service() -> EnhancedHelplinesService:
    """Get or create enhanced helplines service instance"""
    global _enhanced_helplines_service
    if _enhanced_helplines_service is None:
        _enhanced_helplines_service = EnhancedHelplinesService()
    return _enhanced_helplines_service

