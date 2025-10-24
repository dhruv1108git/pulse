"""
Helplines service for location-based emergency contacts
"""

import os
from typing import List, Dict, Optional
from elasticsearch import Elasticsearch
import logging

logger = logging.getLogger(__name__)

class HelplinesService:
    def __init__(self):
        self.es_client = Elasticsearch(
            cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
            api_key=os.getenv('ELASTIC_API_KEY')
        )
        self.helplines_index = 'pulse-helplines'
        logger.info("✅ Helplines Service initialized")

    def get_nearby_helplines(
        self,
        lat: float,
        lon: float,
        distance: str = "100km"
    ) -> Dict:
        """
        Get emergency helplines for a location
        
        Args:
            lat: Latitude
            lon: Longitude
            distance: Search radius (e.g., "50km")
            
        Returns:
            Helpline information with contact numbers
        """
        try:
            # Search for nearest helplines
            response = self.es_client.search(
                index=self.helplines_index,
                body={
                    "size": 1,
                    "query": {
                        "bool": {
                            "filter": {
                                "geo_distance": {
                                    "distance": distance,
                                    "location": {
                                        "lat": lat,
                                        "lon": lon
                                    }
                                }
                            }
                        }
                    },
                    "sort": [
                        {
                            "_geo_distance": {
                                "location": {
                                    "lat": lat,
                                    "lon": lon
                                },
                                "order": "asc",
                                "unit": "km"
                            }
                        }
                    ]
                }
            )
            
            if response['hits']['hits']:
                hit = response['hits']['hits'][0]
                helpline_data = hit['_source']
                distance_km = hit['sort'][0]
                
                return {
                    'found': True,
                    'area_name': helpline_data.get('area_name'),
                    'country': helpline_data.get('country'),
                    'distance_km': round(distance_km, 1),
                    'helplines': helpline_data.get('helplines', {}),
                    'languages': helpline_data.get('languages', ['en'])
                }
            else:
                # Return generic US emergency numbers as fallback
                return {
                    'found': False,
                    'area_name': 'Unknown Location',
                    'country': 'USA',
                    'distance_km': None,
                    'helplines': {
                        'fire': '911',
                        'medical': '911',
                        'police': '911',
                        'poison_control': '1-800-222-1222'
                    },
                    'languages': ['en'],
                    'note': 'Using default emergency numbers. Location may not be in database.'
                }
                
        except Exception as e:
            logger.error(f"Error getting helplines: {e}")
            return {
                'found': False,
                'error': str(e),
                'helplines': {
                    'fire': '911',
                    'medical': '911',
                    'police': '911'
                }
            }

    def get_context_based_suggestions(
        self,
        incident_type: str,
        helplines: Dict[str, str]
    ) -> List[Dict[str, str]]:
        """
        Get context-based helpline suggestions based on incident type
        
        Args:
            incident_type: Type of incident (fire, crime, etc.)
            helplines: Available helplines
            
        Returns:
            List of suggested helplines with priority
        """
        suggestions = []
        
        incident_mapping = {
            'fire': ['fire', 'local_fire_dept', 'medical'],
            'crime': ['police', 'emergency', 'victim_support'],
            'roadblock': ['police', 'fire'],
            'power_outage': ['local_fire_dept', 'disaster_relief'],
            'medical': ['medical', 'poison_control']
        }
        
        priorities = incident_mapping.get(incident_type, ['fire', 'medical', 'police'])
        
        for priority in priorities:
            if priority in helplines:
                suggestions.append({
                    'type': priority,
                    'number': helplines[priority],
                    'priority': 'high' if priorities.index(priority) == 0 else 'medium'
                })
        
        return suggestions


# Global instance
_helplines_service = None

def get_helplines_service() -> HelplinesService:
    """Get or create helplines service instance"""
    global _helplines_service
    if _helplines_service is None:
        _helplines_service = HelplinesService()
    return _helplines_service

