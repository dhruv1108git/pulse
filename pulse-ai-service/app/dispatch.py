"""
Dispatch logic for analyzing incidents and generating alerts
"""

from typing import Dict, Any, Optional
import logging


def analyze_incident(
    incident_data: Dict[str, Any],
    elastic_client: Any,
    vertex_ai_client: Any,
    logger: logging.Logger
) -> Dict[str, Any]:
    """
    Analyze an incident using Elastic hybrid search and Vertex AI
    
    Args:
        incident_data: Incident report data
        elastic_client: Elastic Cloud client instance
        vertex_ai_client: Vertex AI client instance
        logger: Logger instance
    
    Returns:
        Analysis results dictionary
    """
    logger.info(f"Analyzing incident {incident_data.get('report_id')}")
    
    result = {
        'report_id': incident_data.get('report_id'),
        'related_incidents': [],
        'ai_analysis': {},
        'confidence': 0.0,
        'priority': 'medium'
    }
    
    try:
        # Step 1: Generate embedding for the incident if clients are available
        query_vector = None
        if vertex_ai_client:
            try:
                query_text = f"{incident_data.get('title', '')} {incident_data.get('description', '')}"
                query_vector = vertex_ai_client.generate_embedding(query_text)
                logger.info(f"Generated embedding with {len(query_vector)} dimensions")
            except Exception as e:
                logger.warning(f"Failed to generate embedding: {e}")
        
        # Step 2: Search for related incidents in Elastic
        if elastic_client:
            try:
                query_text = f"{incident_data.get('report_type', '')} {incident_data.get('title', '')}"
                related = elastic_client.hybrid_search_incidents(
                    query_text=query_text,
                    query_vector=query_vector,
                    location=incident_data.get('location', {'lat': 0, 'lon': 0}),
                    report_type=incident_data.get('report_type'),
                    time_range='now-15m',
                    distance='500m',
                    size=10
                )
                result['related_incidents'] = related
                logger.info(f"Found {len(related)} related incidents")
            except Exception as e:
                logger.error(f"Failed to search related incidents: {e}")
        
        # Step 3: Analyze with Vertex AI Gemini
        if vertex_ai_client and result['related_incidents']:
            try:
                ai_analysis = vertex_ai_client.analyze_incident_cluster(
                    incidents=result['related_incidents'],
                    current_incident=incident_data
                )
                result['ai_analysis'] = ai_analysis
                result['confidence'] = ai_analysis.get('confidence', 0.5)
                
                # Determine priority based on analysis and related incidents
                result['priority'] = determine_priority(
                    incident_data,
                    result['related_incidents'],
                    ai_analysis
                )
                
                logger.info(f"AI analysis completed with {result['confidence']} confidence")
            except Exception as e:
                logger.error(f"Failed to analyze with Vertex AI: {e}")
        
    except Exception as e:
        logger.error(f"Error in incident analysis: {e}", exc_info=True)
    
    return result


def determine_priority(
    incident: Dict[str, Any],
    related_incidents: list,
    ai_analysis: Dict[str, Any]
) -> str:
    """
    Determine incident priority based on various factors
    
    Args:
        incident: Current incident data
        related_incidents: List of related incidents
        ai_analysis: AI analysis results
    
    Returns:
        Priority level: 'low', 'medium', 'high', or 'critical'
    """
    severity = incident.get('severity', 3)
    related_count = len(related_incidents)
    
    # Check for keywords in Gemini analysis that suggest critical situation
    analysis_text = ai_analysis.get('gemini_analysis', '').lower()
    critical_keywords = ['critical', 'urgent', 'immediate', 'emergency', 'danger']
    has_critical_keywords = any(keyword in analysis_text for keyword in critical_keywords)
    
    # Determine priority
    if severity >= 5 or related_count >= 5 or has_critical_keywords:
        return 'critical'
    elif severity >= 4 or related_count >= 3:
        return 'high'
    elif severity >= 3 or related_count >= 1:
        return 'medium'
    else:
        return 'low'


def generate_alert(
    dispatch_data: Dict[str, Any],
    vertex_ai_client: Any,
    logger: logging.Logger
) -> Dict[str, Any]:
    """
    Generate alert message for authorities
    
    Args:
        dispatch_data: Dispatch request data including analysis
        vertex_ai_client: Vertex AI client instance
        logger: Logger instance
    
    Returns:
        Alert data dictionary
    """
    logger.info(f"Generating alert for {dispatch_data.get('report_id')}")
    
    alert = {
        'report_id': dispatch_data.get('report_id'),
        'priority': dispatch_data.get('priority', 'medium'),
        'message': 'Alert generation failed',
        'timestamp': None
    }
    
    try:
        if vertex_ai_client:
            # Generate alert message using Vertex AI
            analysis = dispatch_data.get('analysis', {})
            
            # Create a simplified incident object for message generation
            incident = {
                'report_type': analysis.get('report_type', 'unknown'),
                'title': analysis.get('title', 'Unknown incident'),
                'description': analysis.get('description', ''),
                'severity': analysis.get('severity', 3),
                'location': analysis.get('location', {'lat': 0, 'lon': 0})
            }
            
            message = vertex_ai_client.generate_alert_message(
                incident,
                analysis.get('ai_analysis', {})
            )
            
            alert['message'] = message
            alert['generated_by'] = 'vertex-ai-gemini'
            
            logger.info("Alert message generated successfully")
        else:
            # Fallback message if Vertex AI is not available
            alert['message'] = (
                f"ALERT: {dispatch_data.get('priority', 'MEDIUM').upper()} priority incident detected. "
                f"Report ID: {dispatch_data.get('report_id')}. "
                f"Please investigate immediately."
            )
            alert['generated_by'] = 'fallback'
            
    except Exception as e:
        logger.error(f"Error generating alert: {e}", exc_info=True)
        alert['message'] = f"Error generating alert: {str(e)}"
        alert['error'] = str(e)
    
    return alert


def format_incident_summary(incident: Dict[str, Any]) -> str:
    """
    Format incident data into a human-readable summary
    
    Args:
        incident: Incident document
    
    Returns:
        Formatted summary string
    """
    return (
        f"Type: {incident.get('report_type', 'unknown').upper()}\n"
        f"Location: {incident.get('location', {}).get('lat', 'N/A')}, "
        f"{incident.get('location', {}).get('lon', 'N/A')}\n"
        f"Severity: {incident.get('severity', 'N/A')}/5\n"
        f"Description: {incident.get('description', 'No description')}\n"
        f"Timestamp: {incident.get('@timestamp', 'N/A')}"
    )


