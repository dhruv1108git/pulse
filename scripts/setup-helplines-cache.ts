import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  cloud: {
    id: process.env.ELASTIC_CLOUD_ID!,
  },
  auth: {
    apiKey: process.env.ELASTIC_API_KEY!,
  },
});

async function setupHelplinesCache() {
  console.log('🔧 Setting up helplines cache index...\n');

  try {
    const cacheIndexExists = await client.indices.exists({
      index: 'pulse-helplines-cache',
    });

    if (!cacheIndexExists) {
      await client.indices.create({
        index: 'pulse-helplines-cache',
        body: {
          mappings: {
            properties: {
              location_name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              location: { type: 'geo_point' },
              emergency: { type: 'keyword' },
              contacts: {
                properties: {
                  type: { type: 'keyword' },
                  number: { type: 'keyword' },
                  source: { type: 'keyword' },
                  confidence: { type: 'float' }
                }
              },
              fallback: { type: 'keyword' },
              sources_checked: { type: 'integer' },
              cached_at: { type: 'date' },
              expires_at: { type: 'date' },
              ttl_days: { type: 'integer' }
            },
          },
        },
      });
      console.log('   ✅ pulse-helplines-cache index created\n');
    } else {
      console.log('   ✅ pulse-helplines-cache already exists\n');
    }

    console.log('✅ Helplines cache setup complete!');
    console.log('\nFeatures:');
    console.log('- 30-day TTL for cached entries');
    console.log('- Web search + LLM extraction on cache miss');
    console.log('- Source citations with confidence scores');
    console.log('- Works for any location worldwide');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupHelplinesCache()
  .catch(console.error)
  .finally(() => process.exit());

