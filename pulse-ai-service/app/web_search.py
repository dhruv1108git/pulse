"""
Web Search Service for Dynamic Helpline Discovery
Uses SerpAPI + Gemini LLM for structured extraction
"""

import os
import logging
from typing import Dict, List, Optional
from serpapi import GoogleSearch
from vertexai.generative_models import GenerativeModel
import vertexai

logger = logging.getLogger(__name__)

class WebSearchService:
    def __init__(self):
        self.serp_api_key = os.getenv('SERPAPI_KEY')
        
        # Initialize Vertex AI
        project_id = os.getenv('VERTEX_AI_PROJECT_ID')
        location = os.getenv('VERTEX_AI_LOCATION', 'us-central1')
        vertexai.init(project=project_id, location=location)
        
        # Initialize Gemini for extraction
        self.llm = GenerativeModel("gemini-2.0-flash-exp")
        
        logger.info("✅ Web Search Service initialized")

    def search_emergency_contacts(
        self, 
        location_name: str,
        incident_type: Optional[str] = None
    ) -> Dict:
        """
        Search web for emergency contacts in a specific location
        
        Args:
            location_name: City/area name (e.g., "San Francisco, CA")
            incident_type: Optional incident type to prioritize (fire, medical, etc.)
            
        Returns:
            Search results with snippets from reliable sources
        """
        try:
            # Build search query
            if incident_type:
                query = f"{location_name} {incident_type} emergency contact number official government"
            else:
                query = f"{location_name} emergency services contact numbers fire police hospital official"
            
            # Add site filters for trusted sources
            query += " site:.gov OR site:.org"
            
            logger.info(f"Searching: {query}")
            
            # Perform search using SerpAPI
            if not self.serp_api_key:
                logger.warning("SERPAPI_KEY not set, using mock data")
                return self._get_mock_search_results(location_name)
            
            params = {
                "q": query,
                "api_key": self.serp_api_key,
                "num": 5,  # Top 5 results
                "hl": "en",
                "gl": "us"
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            # Extract organic results
            organic_results = results.get('organic_results', [])
            
            # Format search results
            formatted_results = []
            for result in organic_results[:5]:
                formatted_results.append({
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'url': result.get('link', ''),
                    'source': result.get('displayed_link', '')
                })
            
            return {
                'success': True,
                'query': query,
                'results': formatted_results,
                'result_count': len(formatted_results)
            }
            
        except Exception as e:
            logger.error(f"Error in web search: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }

    def extract_contacts_with_llm(
        self,
        search_results: List[Dict],
        location_name: str
    ) -> Dict:
        """
        Use Gemini LLM to extract structured contact information from search results
        
        Args:
            search_results: List of search result snippets
            location_name: Location name for context
            
        Returns:
            Structured contact information with confidence scores
        """
        try:
            # Prepare context from search results
            context = f"Location: {location_name}\n\nSearch Results:\n\n"
            for i, result in enumerate(search_results[:5], 1):
                context += f"{i}. {result.get('title', '')}\n"
                context += f"   Source: {result.get('url', '')}\n"
                context += f"   {result.get('snippet', '')}\n\n"
            
            # System prompt for extraction
            system_prompt = """You are an expert at extracting emergency contact information from web search results.

Your task: Extract emergency phone numbers from the provided search results.

Guidelines:
- Only extract phone numbers explicitly mentioned
- Include the service type (fire, police, medical, etc.)
- Note the source URL for each number
- Assign confidence score (0.0-1.0) based on source reliability (.gov = 1.0, .org = 0.8, others = 0.5)
- If no specific number found, return 911 for USA locations

Return JSON format:
{
  "emergency": "911",
  "contacts": [
    {
      "type": "fire",
      "number": "(555) 123-4567",
      "source": "https://city.gov/fire",
      "confidence": 0.95
    }
  ],
  "fallback": "911",
  "sources_checked": 5
}

Be precise. Only include what's clearly stated."""

            user_prompt = f"Extract emergency contact information from these search results:\n\n{context}"
            
            # Combine system and user prompts
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            # Call Gemini
            response = self.llm.generate_content(full_prompt)
            
            # Parse JSON response
            import json
            
            # Extract JSON from response (handle markdown code blocks)
            response_text = response.text.strip()
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0].strip()
            
            extracted_data = json.loads(response_text)
            
            logger.info(f"Extracted {len(extracted_data.get('contacts', []))} contacts")
            
            return {
                'success': True,
                'data': extracted_data,
                'llm_used': True
            }
            
        except Exception as e:
            logger.error(f"Error in LLM extraction: {e}")
            # Fallback to basic extraction
            return {
                'success': False,
                'error': str(e),
                'data': {
                    'emergency': '911',
                    'contacts': [],
                    'fallback': '911',
                    'sources_checked': 0
                },
                'llm_used': False
            }

    def _get_mock_search_results(self, location_name: str) -> Dict:
        """Mock search results for testing when API key not available"""
        return {
            'success': True,
            'query': f"{location_name} emergency contacts",
            'results': [
                {
                    'title': f'{location_name} Fire Department',
                    'snippet': 'For emergencies, call 911. Non-emergency fire department contact: (555) 123-4567',
                    'url': f'https://{location_name.lower().replace(" ", "")}.gov/fire',
                    'source': f'{location_name}.gov'
                },
                {
                    'title': f'{location_name} Police Department',
                    'snippet': 'Emergency: 911. Non-emergency police: (555) 234-5678',
                    'url': f'https://{location_name.lower().replace(" ", "")}.gov/police',
                    'source': f'{location_name}.gov'
                },
                {
                    'title': 'Poison Control Center',
                    'snippet': 'National Poison Control hotline: 1-800-222-1222',
                    'url': 'https://poisoncontrol.org',
                    'source': 'poisoncontrol.org'
                }
            ],
            'result_count': 3
        }


# Global instance
_web_search_service = None

def get_web_search_service() -> WebSearchService:
    """Get or create web search service instance"""
    global _web_search_service
    if _web_search_service is None:
        _web_search_service = WebSearchService()
    return _web_search_service

