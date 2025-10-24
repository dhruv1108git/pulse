#!/usr/bin/env tsx
/**
 * Setup Elasticsearch indices for offline relay system
 * Creates pulse-relay-queries index for query tracking and deduplication
 */

import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ELASTIC_CLOUD_ID = process.env.ELASTIC_CLOUD_ID;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;
const RELAY_INDEX = 'pulse-relay-queries';

if (!ELASTIC_CLOUD_ID || !ELASTIC_API_KEY) {
  console.error('❌ Missing required environment variables: ELASTIC_CLOUD_ID, ELASTIC_API_KEY');
  process.exit(1);
}

// Initialize Elasticsearch client
const client = new Client({
  cloud: { id: ELASTIC_CLOUD_ID },
  auth: { apiKey: ELASTIC_API_KEY },
});

async function setupRelayIndices() {
  console.log('🔧 Setting up Elasticsearch relay indices...\n');

  try {
    // Check if index already exists
    const indexExists = await client.indices.exists({ index: RELAY_INDEX });

    if (indexExists) {
      console.log(`⚠️  Index ${RELAY_INDEX} already exists. Deleting...`);
      await client.indices.delete({ index: RELAY_INDEX });
      console.log(`✅ Deleted existing index\n`);
    }

    // Create relay queries index
    console.log(`📝 Creating index: ${RELAY_INDEX}`);
    await client.indices.create({
      index: RELAY_INDEX,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          refresh_interval: '1s',
        },
        mappings: {
          properties: {
            query_id: {
              type: 'keyword',
              // Unique identifier for query deduplication
            },
            query_text: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            query_type: {
              type: 'keyword',
              // "assistant" | "sos"
            },
            status: {
              type: 'keyword',
              // "pending" | "processing" | "completed" | "failed"
            },
            response: {
              type: 'text',
              // AI response or SOS confirmation
            },
            user_location: {
              type: 'geo_point',
              // User's location when query was made
            },
            severity: {
              type: 'keyword',
              // For SOS: "low" | "medium" | "high" | "critical"
            },
            emergency_type: {
              type: 'keyword',
              // For SOS: "fire" | "medical" | "police" | "violence" | "other"
            },
            timestamp: {
              type: 'date',
              // When query was created
            },
            completed_at: {
              type: 'date',
              // When query was completed
            },
            relayed_by: {
              type: 'keyword',
              // Device ID that processed the query (had internet)
            },
            original_device: {
              type: 'keyword',
              // Device ID that originated the query
            },
            relay_path: {
              type: 'keyword',
              // Array of device IDs showing relay path
            },
            error_message: {
              type: 'text',
              // Error details if query failed
            },
            sms_dispatch: {
              type: 'object',
              properties: {
                message_sid: { type: 'keyword' },
                to_number: { type: 'keyword' },
                emergency_service: { type: 'keyword' },
                sent_at: { type: 'date' },
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    });

    console.log(`✅ Created ${RELAY_INDEX} index\n`);

    // Verify index creation
    const stats = await client.indices.stats({ index: RELAY_INDEX });
    console.log('📊 Index Statistics:');
    console.log(`   - Index: ${RELAY_INDEX}`);
    console.log(`   - Shards: ${stats._shards.total}`);
    console.log(`   - Status: Active\n`);

    console.log('✅ Relay indices setup complete!\n');
    console.log('📝 Summary:');
    console.log(`   - ${RELAY_INDEX}: Query tracking and deduplication`);
    console.log('\n🚀 The offline relay system is ready to use!');

  } catch (error: any) {
    console.error('❌ Error setting up relay indices:', error.message);
    if (error.meta?.body?.error) {
      console.error('   Details:', JSON.stringify(error.meta.body.error, null, 2));
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run setup
setupRelayIndices();

