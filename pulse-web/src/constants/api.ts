// API configuration for web
// For local development, run: REACT_APP_API_URL=http://localhost:5001 npm run dev
// For production, the build always uses the Cloud Run URL
export const API_BASE_URL = 
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5001' // Local development
    : 'https://pulse-474o3a7wtq-uc.a.run.app'; // Production Cloud Run URL

