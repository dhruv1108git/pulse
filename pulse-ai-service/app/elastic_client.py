"""
Elastic Cloud client for querying incidents and logging dispatch actions
"""

import os
from elasticsearch import Elasticsearch
from typing import List, Dict, Any, Optional


class ElasticClient:
    def __init__(self, cloud_id: str, api_key: str):
        """Initialize Elastic Cloud client"""
        if not cloud_id or not api_key:
            raise ValueError('Elastic Cloud ID and API key are required')
        
        self.client = Elasticsearch(
            cloud_id=cloud_id,
            api_key=api_key
        )
        
        self.incidents_index = os.getenv('ELASTIC_INCIDENTS_INDEX', 'pulse-incidents')
        self.dispatch_log_index = os.getenv('ELASTIC_DISPATCH_LOG_INDEX', 'pulse-dispatch-log')
        self.relay_queries_index = 'pulse-relay-queries'
    
    def hybrid_search_incidents(
        self,
        query_text: str,
        query_vector: Optional[List[float]],
        location: Dict[str, float],
        report_type: Optional[str] = None,
        time_range: str = 'now-15m',
        distance: str = '500m',
        size: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search (BM25 + vector) for similar incidents
        
        Args:
            query_text: Text query for BM25 search
            query_vector: Embedding vector for kNN search
            location: {"lat": float, "lon": float}
            report_type: Filter by report type
            time_range: Elasticsearch time range (e.g., 'now-15m')
            distance: Geo distance for filtering (e.g., '500m')
            size: Number of results to return
        
        Returns:
            List of matching incident documents
        """
        # Build query
        must_clauses = [
            {
                'multi_match': {
                    'query': query_text,
                    'fields': ['title', 'description', 'report_type']
                }
            },
            {
                'range': {
                    '@timestamp': {
                        'gte': time_range
                    }
                }
            }
        ]
        
        if report_type:
            must_clauses.append({
                'match': {
                    'report_type': report_type
                }
            })
        
        query_body = {
            'query': {
                'bool': {
                    'must': must_clauses,
                    'filter': {
                        'geo_distance': {
                            'distance': distance,
                            'location': location
                        }
                    }
                }
            },
            'size': size
        }
        
        # Add kNN vector search if embedding provided
        if query_vector and len(query_vector) > 0:
            query_body['knn'] = {
                'field': 'text_embedding',
                'query_vector': query_vector,
                'k': size,
                'num_candidates': size * 10
            }
        
        # Execute search
        response = self.client.search(
            index=self.incidents_index,
            body=query_body
        )
        
        # Extract and return results
        results = []
        for hit in response['hits']['hits']:
            result = hit['_source']
            result['_score'] = hit['_score']
            result['_id'] = hit['_id']
            results.append(result)
        
        return results
    
    def get_incident_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific incident by report_id"""
        try:
            response = self.client.search(
                index=self.incidents_index,
                body={
                    'query': {
                        'term': {
                            'report_id': report_id
                        }
                    },
                    'size': 1
                }
            )
            
            if response['hits']['total']['value'] > 0:
                return response['hits']['hits'][0]['_source']
            return None
        except Exception:
            return None
    
    def store_incident(self, incident_data: Dict[str, Any]) -> str:
        """
        Store an incident directly in Elasticsearch
        
        Args:
            incident_data: Dictionary containing incident details
            
        Returns:
            Document ID
        """
        response = self.client.index(
            index=self.incidents_index,
            document=incident_data
        )
        return response['_id']
    
    def log_dispatch_action(self, action_data: Dict[str, Any]) -> str:
        """
        Log a dispatch action to Elastic
        
        Args:
            action_data: Dictionary containing action details
        
        Returns:
            Document ID
        """
        response = self.client.index(
            index=self.dispatch_log_index,
            document=action_data
        )
        return response['_id']
    
    def get_recent_incidents_by_type(
        self,
        report_type: str,
        time_range: str = 'now-1h',
        size: int = 100
    ) -> List[Dict[str, Any]]:
        """Get recent incidents of a specific type"""
        response = self.client.search(
            index=self.incidents_index,
            body={
                'query': {
                    'bool': {
                        'must': [
                            {'match': {'report_type': report_type}},
                            {
                                'range': {
                                    '@timestamp': {
                                        'gte': time_range
                                    }
                                }
                            }
                        ]
                    }
                },
                'size': size,
                'sort': [
                    {'@timestamp': {'order': 'desc'}}
                ]
            }
        )
        
        return [hit['_source'] for hit in response['hits']['hits']]
    
    def aggregate_incidents_by_location(
        self,
        location: Dict[str, float],
        distance: str = '1km',
        time_range: str = 'now-1h'
    ) -> Dict[str, Any]:
        """Get aggregated incident counts by type near a location"""
        response = self.client.search(
            index=self.incidents_index,
            body={
                'query': {
                    'bool': {
                        'must': [
                            {
                                'range': {
                                    '@timestamp': {
                                        'gte': time_range
                                    }
                                }
                            }
                        ],
                        'filter': {
                            'geo_distance': {
                                'distance': distance,
                                'location': location
                            }
                        }
                    }
                },
                'aggs': {
                    'by_type': {
                        'terms': {
                            'field': 'report_type',
                            'size': 10
                        }
                    },
                    'by_severity': {
                        'terms': {
                            'field': 'severity',
                            'size': 5
                        }
                    }
                },
                'size': 0
            }
        )
        
        return {
            'total': response['hits']['total']['value'],
            'by_type': response['aggregations']['by_type']['buckets'],
            'by_severity': response['aggregations']['by_severity']['buckets']
        }

    def list_recent_incidents(self, size: int = 200) -> List[Dict[str, Any]]:
        """List most recent incidents sorted by @timestamp desc"""
        response = self.client.search(
            index=self.incidents_index,
            body={
                'query': {
                    'match_all': {}
                },
                'sort': [
                    {'@timestamp': {'order': 'desc'}}
                ],
                'size': size
            }
        )
        return [hit['_source'] for hit in response['hits']['hits']]
    
    # ============= Relay Query Methods =============
    
    def get_relay_query(self, query_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a relay query by its unique ID
        
        Args:
            query_id: Unique query identifier
            
        Returns:
            Query document if found, None otherwise
        """
        try:
            response = self.client.search(
                index=self.relay_queries_index,
                body={
                    'query': {
                        'term': {
                            'query_id': query_id
                        }
                    },
                    'size': 1
                }
            )
            
            if response['hits']['total']['value'] > 0:
                doc = response['hits']['hits'][0]['_source']
                doc['_id'] = response['hits']['hits'][0]['_id']
                return doc
            return None
        except Exception:
            return None
    
    def store_relay_query(self, query_data: Dict[str, Any]) -> str:
        """
        Store or update a relay query
        
        Args:
            query_data: Dictionary containing query details
            
        Returns:
            Document ID
        """
        # Check if query already exists
        existing = self.get_relay_query(query_data['query_id'])
        
        if existing:
            # Update existing query
            response = self.client.update(
                index=self.relay_queries_index,
                id=existing['_id'],
                body={
                    'doc': query_data
                }
            )
            return response['_id']
        else:
            # Create new query
            response = self.client.index(
                index=self.relay_queries_index,
                document=query_data
            )
            return response['_id']
    
    def mark_query_completed(
        self, 
        query_id: str, 
        response_data: str,
        relayed_by: Optional[str] = None,
        sms_dispatch: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Mark a relay query as completed with response
        
        Args:
            query_id: Unique query identifier
            response_data: Response text or confirmation
            relayed_by: Device ID that processed the query
            sms_dispatch: SMS dispatch details for SOS messages
            
        Returns:
            True if successful, False otherwise
        """
        from datetime import datetime, timezone
        
        try:
            existing = self.get_relay_query(query_id)
            if not existing:
                return False
            
            update_doc = {
                'status': 'completed',
                'response': response_data,
                'completed_at': datetime.now(timezone.utc).isoformat()
            }
            
            if relayed_by:
                update_doc['relayed_by'] = relayed_by
            
            if sms_dispatch:
                update_doc['sms_dispatch'] = sms_dispatch
            
            self.client.update(
                index=self.relay_queries_index,
                id=existing['_id'],
                body={
                    'doc': update_doc
                }
            )
            return True
        except Exception:
            return False
    
    def mark_query_processing(self, query_id: str, relayed_by: str) -> bool:
        """
        Mark a relay query as being processed
        
        Args:
            query_id: Unique query identifier
            relayed_by: Device ID processing the query
            
        Returns:
            True if successful, False otherwise
        """
        try:
            existing = self.get_relay_query(query_id)
            if not existing:
                return False
            
            self.client.update(
                index=self.relay_queries_index,
                id=existing['_id'],
                body={
                    'doc': {
                        'status': 'processing',
                        'relayed_by': relayed_by
                    }
                }
            )
            return True
        except Exception:
            return False
    
    def mark_query_failed(self, query_id: str, error_message: str) -> bool:
        """
        Mark a relay query as failed
        
        Args:
            query_id: Unique query identifier
            error_message: Error description
            
        Returns:
            True if successful, False otherwise
        """
        from datetime import datetime, timezone
        
        try:
            existing = self.get_relay_query(query_id)
            if not existing:
                return False
            
            self.client.update(
                index=self.relay_queries_index,
                id=existing['_id'],
                body={
                    'doc': {
                        'status': 'failed',
                        'error_message': error_message,
                        'completed_at': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            return True
        except Exception:
            return False


