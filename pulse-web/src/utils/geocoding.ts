// Geocoding utility using Google Maps Geocoding API

export interface Address {
  formatted: string;
  city?: string;
  area?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Address | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Geocoding failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('📍 Google Maps Geocoding response status:', data.status);
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('No address data in Google Maps response');
      return null;
    }

    const result = data.results[0];
    const addressComponents = result.address_components;

    // Helper to find address component by type
    const getComponent = (types: string[]) => {
      const component = addressComponents.find((c: any) =>
        types.some((type: string) => c.types.includes(type))
      );
      return component?.long_name;
    };

    const formatted = result.formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const area = getComponent(['sublocality', 'neighborhood', 'sublocality_level_1']);
    const city = getComponent(['locality', 'administrative_area_level_2']);
    const state = getComponent(['administrative_area_level_1']);
    const country = getComponent(['country']);
    const countryCode = addressComponents.find((c: any) => c.types.includes('country'))?.short_name;

    console.log('✅ Parsed address - area:', area, 'city:', city);

    return {
      formatted,
      city: city || undefined,
      area: area || undefined,
      state: state || undefined,
      country: country || undefined,
      countryCode: countryCode || undefined,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export function getShortLocation(address: Address | null, fallbackCoords?: { lat: number; lon: number }): string {
  if (!address) {
    if (fallbackCoords) {
      return `${fallbackCoords.lat.toFixed(4)}, ${fallbackCoords.lon.toFixed(4)}`;
    }
    return 'Unknown Location';
  }
  
  if (address.area && address.city) {
    return `${address.area}, ${address.city}`;
  }
  
  if (address.city) {
    return address.city;
  }
  
  if (address.area) {
    return address.area;
  }
  
  return address.formatted;
}

