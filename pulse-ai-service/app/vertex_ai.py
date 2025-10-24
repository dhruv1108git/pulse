"""
Vertex AI client for embeddings and Gemini LLM integration
"""

import os
from typing import List, Dict, Any, Optional
from google.cloud import aiplatform
from google.cloud.aiplatform_v1 import PredictionServiceClient
from google.protobuf import json_format
from google.protobuf.struct_pb2 import Value


class VertexAIClient:
    def __init__(self, project_id: str, location: str = 'us-central1'):
        """Initialize Vertex AI client"""
        if not project_id:
            raise ValueError('Vertex AI project ID is required')
        
        self.project_id = project_id
        self.location = location
        
        # Get credentials from Application Default Credentials (works in Cloud Run)
        # Unset GOOGLE_APPLICATION_CREDENTIALS to force ADC to use metadata service
        import google.auth
        if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
            del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
            
        credentials, project = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        
        # Initialize AI Platform
        aiplatform.init(
            project=project_id or project,
            location=location,
            credentials=credentials
        )
        
        # Initialize prediction client for embeddings
        self.prediction_client = PredictionServiceClient(
            client_options={'api_endpoint': f'{location}-aiplatform.googleapis.com'},
            credentials=credentials
        )
        
        self.embedding_model = os.getenv('VERTEX_AI_EMBEDDING_MODEL', 'textembedding-gecko@003')
        self.llm_model = os.getenv('VERTEX_AI_LLM_MODEL', 'gemini-1.5-flash')
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using Vertex AI
        
        Args:
            text: Text to embed
        
        Returns:
            List of embedding values
        """
        try:
            endpoint = f'projects/{self.project_id}/locations/{self.location}/publishers/google/models/{self.embedding_model}'
            
            # Prepare instance
            instance = Value()
            instance.struct_value.fields['content'].string_value = text
            
            # Make prediction request
            response = self.prediction_client.predict(
                endpoint=endpoint,
                instances=[instance]
            )
            
            # Extract embeddings from response
            if response.predictions:
                prediction = response.predictions[0]
                embeddings = prediction.struct_value.fields['embeddings'].struct_value.fields['values'].list_value.values
                return [float(v.number_value) for v in embeddings]
            
            return []
        except Exception as e:
            print(f'Error generating embedding: {e}')
            return []
    
    def analyze_with_gemini(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """
        Analyze incidents using Gemini LLM
        
        Args:
            prompt: Prompt for the LLM
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
        
        Returns:
            Generated text response
        """
        try:
            from vertexai.generative_models import GenerativeModel, GenerationConfig
            
            # Initialize model
            model = GenerativeModel(self.llm_model)
            
            # Configure generation
            config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
            
            # Generate response
            response = model.generate_content(
                prompt,
                generation_config=config
            )
            
            return response.text
        except Exception as e:
            print(f'Error with Gemini analysis: {e}')
            return f'Error: {str(e)}'
    
    def analyze_incident_cluster(
        self,
        incidents: List[Dict[str, Any]],
        current_incident: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze a cluster of related incidents and generate insights
        
        Args:
            incidents: List of related incident documents
            current_incident: The current incident being analyzed
        
        Returns:
            Dictionary with analysis results
        """
        # Build context from incidents
        incident_summaries = []
        for inc in incidents:
            summary = (
                f"- {inc.get('report_type', 'unknown').upper()}: "
                f"{inc.get('title', 'No title')} "
                f"(Severity: {inc.get('severity', 'N/A')})"
            )
            incident_summaries.append(summary)
        
        context = '\n'.join(incident_summaries)
        
        # Build prompt for Gemini
        prompt = f"""
You are an emergency response AI assistant. Analyze the following incident cluster:

Current Incident:
- Type: {current_incident.get('report_type', 'unknown').upper()}
- Title: {current_incident.get('title', 'No title')}
- Description: {current_incident.get('description', 'No description')}
- Severity: {current_incident.get('severity', 'N/A')}

Related Recent Incidents in the area:
{context if context else 'No related incidents found'}

Please provide:
1. A brief assessment of the situation (2-3 sentences)
2. Recommended priority level (Low, Medium, High, or Critical)
3. Suggested immediate actions (bullet points)
4. Any patterns or concerns you notice

Keep your response concise and actionable for emergency responders.
"""
        
        # Get analysis from Gemini
        analysis_text = self.analyze_with_gemini(prompt, temperature=0.3)
        
        return {
            'gemini_analysis': analysis_text,
            'related_incident_count': len(incidents),
            'incident_types': list(set(inc.get('report_type') for inc in incidents if inc.get('report_type'))),
            'confidence': 0.85 if len(incidents) > 0 else 0.5
        }
    
    def generate_alert_message(
        self,
        incident: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """
        Generate a formatted alert message for authorities
        
        Args:
            incident: Incident document
            analysis: Analysis results from analyze_incident_cluster
        
        Returns:
            Formatted alert message
        """
        prompt = f"""
Generate a concise alert message for emergency responders based on this incident:

Type: {incident.get('report_type', 'unknown').upper()}
Location: Lat {incident.get('location', {}).get('lat', 'N/A')}, Lon {incident.get('location', {}).get('lon', 'N/A')}
Severity: {incident.get('severity', 'N/A')}/5
Description: {incident.get('description', 'No description')}

Analysis Summary:
{analysis.get('gemini_analysis', 'No analysis available')[:500]}

Create a professional alert message that includes:
1. Incident type and location
2. Severity assessment
3. Immediate action required
4. Keep it under 200 words

Format as a direct message to emergency services.
"""
        
        return self.analyze_with_gemini(prompt, temperature=0.2, max_tokens=300)


