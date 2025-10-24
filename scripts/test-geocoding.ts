import path from 'path';
import { reverseGeocode } from '../pulse-mobile/src/utils/geocoding';

// Polyfill fetch
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

async function testGeocoding() {
  console.log('🧪 Running geocoding test...');

  // Co-ordinates for a known location (e.g., Empire State Building)
  const lat = 40.7484405;
  const lon = -73.9856644;

  console.log(`\nTesting with coordinates: Lat ${lat}, Lon ${lon}`);
  
  try {
    const address = await reverseGeocode(lat, lon);

    if (address) {
      console.log('✅ Geocoding successful!');
      console.log('   Formatted Address:', address.formatted);
      console.log('   City:', address.city || 'N/A');
      console.log('   Area:', address.area || 'N/A');
      console.log('   State:', address.state || 'N/A');
      console.log('   Country:', address.country || 'N/A');
    } else {
      console.error('❌ Geocoding failed. Received null address.');
    }
  } catch (error) {
    console.error('❌ An error occurred during geocoding test:', error);
  }

  // Co-ordinates for another location (e.g., Golden Gate Bridge)
  const lat2 = 37.8199;
  const lon2 = -122.4783;

  console.log(`\nTesting with coordinates: Lat ${lat2}, Lon ${lon2}`);
  
  try {
    const address2 = await reverseGeocode(lat2, lon2);

    if (address2) {
      console.log('✅ Geocoding successful!');
      console.log('   Formatted Address:', address2.formatted);
      console.log('   City:', address2.city || 'N/A');
      console.log('   Area:', address2.area || 'N/A');
      console.log('   State:', address2.state || 'N/A');
      console.log('   Country:', address2.country || 'N/A');
    } else {
      console.error('❌ Geocoding failed. Received null address.');
    }
  } catch (error) {
    console.error('❌ An error occurred during geocoding test:', error);
  }

  console.log('\n✅ Geocoding test finished.');
}

testGeocoding();
