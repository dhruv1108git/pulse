"""
Safety Insights Service
Showcases: Aggregations, Stats, Percentiles, Geospatial Analytics
Demonstrates Elasticsearch's analytical capabilities
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)


class InsightsService:
    def __init__(self):
        self.es_client = Elasticsearch(
            cloud_id=os.getenv('ELASTIC_CLOUD_ID'),
            api_key=os.getenv('ELASTIC_API_KEY')
        )
        
        self.incidents_index = 'pulse-incidents'
        
        logger.info("✅ Insights Service initialized")

    def get_safety_score(
        self,
        location: Optional[Dict[str, float]] = None,
        radius: str = '10km',
        time_range: str = '7d'
    ) -> Dict[str, Any]:
        """
        Calculate safety score for an area using aggregations
        
        Demonstrates: Stats aggregations, percentiles, time filters
        
        Args:
            location: Center point (lat, lon)
            radius: Search radius
            time_range: Time window (e.g., '7d', '30d')
            
        Returns:
            Safety metrics and score
        """
        try:
            # Build query
            query = {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "timestamp": {
                                    "gte": f"now-{time_range}",
                                    "lte": "now"
                                }
                            }
                        }
                    ]
                }
            }
            
            # Add geo filter if location provided
            if location:
                query["bool"]["filter"] = {
                    "geo_distance": {
                        "distance": radius,
                        "location": {
                            "lat": location['lat'],
                            "lon": location['lon']
                        }
                    }
                }
            
            # Execute aggregations
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "size": 0,
                    "query": query,
                    "aggs": {
                        # Total incident count
                        "total_incidents": {
                            "value_count": {"field": "id.keyword"}
                        },
                        # Incidents by type
                        "by_type": {
                            "terms": {
                                "field": "report_type",
                                "size": 10
                            }
                        },
                        # Incidents by status
                        "by_status": {
                            "terms": {
                                "field": "status",
                                "size": 10
                            }
                        },
                        # Safety impact statistics
                        "impact_stats": {
                            "stats": {
                                "field": "safety_impact_score"
                            }
                        },
                        # Safety impact percentiles
                        "impact_percentiles": {
                            "percentiles": {
                                "field": "safety_impact_score",
                                "percents": [25, 50, 75, 90, 95, 99]
                            }
                        },
                        # Recent trend (last 24h)
                        "recent_trend": {
                            "filter": {
                                "range": {
                                    "timestamp": {
                                        "gte": "now-24h"
                                    }
                                }
                            },
                            "aggs": {
                                "count": {
                                    "value_count": {"field": "id.keyword"}
                                }
                            }
                        },
                        # Critical incidents (high impact score)
                        "critical_count": {
                            "filter": {
                                "range": {
                                    "safety_impact_score": {"gte": 8}
                                }
                            }
                        }
                    }
                }
            )
            
            aggs = response['aggregations']
            
            # Calculate safety score (0-100, lower is safer)
            total = aggs['total_incidents']['value']
            critical = aggs['critical_count']['doc_count']
            avg_impact = aggs['impact_stats']['avg'] or 0
            recent_count = aggs['recent_trend']['count']['value']
            
            # Formula: weighted combination
            # More incidents = higher score (worse)
            # More critical = higher score (worse)
            # Higher avg impact = higher score (worse)
            safety_score = min(100, (
                (total / 10) * 10 +  # 10 incidents = 10 points
                (critical / 5) * 20 +  # 5 critical = 20 points
                avg_impact * 5 +  # Avg impact scaled
                (recent_count / 5) * 10  # Recent activity
            ))
            
            # Invert so higher = safer
            safety_score = 100 - safety_score
            
            # Get incident types breakdown
            types_breakdown = [
                {
                    'type': bucket['key'],
                    'count': bucket['doc_count']
                }
                for bucket in aggs['by_type']['buckets']
            ]
            
            # Get status breakdown
            status_breakdown = [
                {
                    'status': bucket['key'],
                    'count': bucket['doc_count']
                }
                for bucket in aggs['by_status']['buckets']
            ]
            
            return {
                'success': True,
                'safety_score': round(safety_score, 1),
                'metrics': {
                    'total_incidents': int(total),
                    'critical_incidents': critical,
                    'recent_24h': recent_count,
                    'avg_impact': round(avg_impact, 2),
                    'max_impact': aggs['impact_stats']['max'],
                    'min_impact': aggs['impact_stats']['min'],
                    'impact_percentiles': {
                        f'p{int(k)}': round(v, 2)
                        for k, v in aggs['impact_percentiles']['values'].items()
                    },
                    'by_type': types_breakdown,
                    'by_status': status_breakdown
                },
                'time_range': time_range,
                'location': location,
                'radius': radius
            }
            
        except Exception as e:
            logger.error(f"Error calculating safety score: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_trends(
        self,
        interval: str = '1h',
        time_range: str = '24h',
        location: Optional[Dict[str, float]] = None,
        radius: str = '50km'
    ) -> Dict[str, Any]:
        """
        Get incident trends over time
        
        Demonstrates: Date histogram, time-based aggregations
        
        Args:
            interval: Time bucket size (1h, 1d, etc.)
            time_range: How far back to look
            location: Optional location filter
            radius: Search radius if location provided
            
        Returns:
            Time-series data of incidents
        """
        try:
            # Build query
            query = {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "timestamp": {
                                    "gte": f"now-{time_range}",
                                    "lte": "now"
                                }
                            }
                        }
                    ]
                }
            }
            
            if location:
                query["bool"]["filter"] = {
                    "geo_distance": {
                        "distance": radius,
                        "location": {
                            "lat": location['lat'],
                            "lon": location['lon']
                        }
                    }
                }
            
            # Execute date histogram
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "size": 0,
                    "query": query,
                    "aggs": {
                        "incidents_over_time": {
                            "date_histogram": {
                                "field": "timestamp",
                                "calendar_interval": interval,
                                "min_doc_count": 0,
                                "extended_bounds": {
                                    "min": f"now-{time_range}",
                                    "max": "now"
                                }
                            },
                            "aggs": {
                                # Break down by type within each time bucket
                                "by_type": {
                                    "terms": {
                                        "field": "report_type",
                                        "size": 10
                                    }
                                },
                                # Average impact score per time bucket
                                "avg_impact": {
                                    "avg": {
                                        "field": "safety_impact_score"
                                    }
                                }
                            }
                        }
                    }
                }
            )
            
            buckets = response['aggregations']['incidents_over_time']['buckets']
            
            # Format time series data
            time_series = []
            for bucket in buckets:
                types_data = {
                    item['key']: item['doc_count']
                    for item in bucket['by_type']['buckets']
                }
                
                time_series.append({
                    'timestamp': bucket['key_as_string'],
                    'timestamp_ms': bucket['key'],
                    'total_count': bucket['doc_count'],
                    'avg_impact': round(bucket['avg_impact']['value'], 2) if bucket['avg_impact']['value'] else 0,
                    'by_type': types_data
                })
            
            return {
                'success': True,
                'interval': interval,
                'time_range': time_range,
                'data_points': len(time_series),
                'time_series': time_series
            }
            
        except Exception as e:
            logger.error(f"Error getting trends: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_hotspots(
        self,
        precision: int = 5,
        time_range: str = '7d',
        min_incidents: int = 2
    ) -> Dict[str, Any]:
        """
        Identify incident hotspots using geohash aggregation
        
        Demonstrates: Geohash grid, geospatial analytics
        
        Args:
            precision: Geohash precision (1-12, higher = smaller areas)
            time_range: Time window
            min_incidents: Minimum incidents to be considered a hotspot
            
        Returns:
            List of hotspot areas with incident counts
        """
        try:
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "size": 0,
                    "query": {
                        "range": {
                            "timestamp": {
                                "gte": f"now-{time_range}",
                                "lte": "now"
                            }
                        }
                    },
                    "aggs": {
                        "incident_hotspots": {
                            "geohash_grid": {
                                "field": "location",
                                "precision": precision
                            },
                            "aggs": {
                                # Get the centroid (center point) of each hotspot
                                "centroid": {
                                    "geo_centroid": {
                                        "field": "location"
                                    }
                                },
                                # Most common incident type in this area
                                "top_type": {
                                    "terms": {
                                        "field": "report_type",
                                        "size": 1
                                    }
                                },
                                # Average safety impact
                                "avg_impact": {
                                    "avg": {
                                        "field": "safety_impact_score"
                                    }
                                }
                            }
                        }
                    }
                }
            )
            
            hotspots = []
            for bucket in response['aggregations']['incident_hotspots']['buckets']:
                if bucket['doc_count'] >= min_incidents:
                    centroid = bucket['centroid']['location']
                    top_type = bucket['top_type']['buckets'][0] if bucket['top_type']['buckets'] else None
                    
                    hotspots.append({
                        'geohash': bucket['key'],
                        'location': {
                            'lat': centroid['lat'],
                            'lon': centroid['lon']
                        },
                        'incident_count': bucket['doc_count'],
                        'top_incident_type': top_type['key'] if top_type else 'unknown',
                        'avg_impact': round(bucket['avg_impact']['value'], 2) if bucket['avg_impact']['value'] else 0
                    })
            
            # Sort by incident count
            hotspots.sort(key=lambda x: x['incident_count'], reverse=True)
            
            return {
                'success': True,
                'time_range': time_range,
                'precision': precision,
                'hotspot_count': len(hotspots),
                'hotspots': hotspots[:20]  # Top 20 hotspots
            }
            
        except Exception as e:
            logger.error(f"Error getting hotspots: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_summary_stats(self) -> Dict[str, Any]:
        """
        Get overall system statistics
        
        Demonstrates: Multiple aggregations in one query
        """
        try:
            response = self.es_client.search(
                index=self.incidents_index,
                body={
                    "size": 0,
                    "aggs": {
                        "total": {
                            "value_count": {"field": "id.keyword"}
                        },
                        "last_24h": {
                            "filter": {
                                "range": {
                                    "timestamp": {"gte": "now-24h"}
                                }
                            }
                        },
                        "last_7d": {
                            "filter": {
                                "range": {
                                    "timestamp": {"gte": "now-7d"}
                                }
                            }
                        },
                        "active": {
                            "filter": {
                                "term": {"status": "active"}
                            }
                        },
                        "resolved": {
                            "filter": {
                                "term": {"status": "resolved"}
                            }
                        },
                        "types": {
                            "terms": {
                                "field": "report_type",
                                "size": 10
                            }
                        }
                    }
                }
            )
            
            aggs = response['aggregations']
            
            return {
                'success': True,
                'stats': {
                    'total_incidents': aggs['total']['value'],
                    'last_24h': aggs['last_24h']['doc_count'],
                    'last_7d': aggs['last_7d']['doc_count'],
                    'active': aggs['active']['doc_count'],
                    'resolved': aggs['resolved']['doc_count'],
                    'types': [
                        {'type': b['key'], 'count': b['doc_count']}
                        for b in aggs['types']['buckets']
                    ]
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting summary stats: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Global instance
_insights_service = None

def get_insights_service() -> InsightsService:
    """Get or create insights service instance"""
    global _insights_service
    if _insights_service is None:
        _insights_service = InsightsService()
    return _insights_service

