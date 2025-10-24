// API configuration for mobile
// For development:
//   - Real devices: Set your computer's IP (e.g., 'http://192.168.1.100:5001')
//   - Emulator: Use 'http://10.0.2.2:5001'
// For production: Use your deployed Cloud Run URL
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5001' // Change this to your local IP for dev on real devices
  : 'https://your-cloud-run-url.run.app'; // Will be updated for production
