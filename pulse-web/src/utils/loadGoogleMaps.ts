/**
 * Dynamically load Google Maps JavaScript API
 * This ensures the API key comes from environment variables, not hardcoded
 */

let googleMapsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export function loadGoogleMapsAPI(): Promise<void> {
  // Return existing promise if already loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Return resolved promise if already loaded
  if (googleMapsLoaded || window.google?.maps) {
    googleMapsLoaded = true;
    return Promise.resolve();
  }

  // Create new loading promise
  loadingPromise = new Promise((resolve, reject) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      reject(new Error('GOOGLE_MAPS_API_KEY not configured. Please set it in your .env file.'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('✅ Google Maps API loaded');
      googleMapsLoaded = true;
      resolve();
    };

    script.onerror = () => {
      const error = new Error('Failed to load Google Maps API');
      console.error('❌', error);
      reject(error);
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return googleMapsLoaded || !!window.google?.maps;
}

