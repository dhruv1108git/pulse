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

async function setupIndices() {
  console.log('🔧 Setting up Elasticsearch indices...\n');

  // 1. Enhanced pulse-incidents index with vector support
  console.log('1. Creating/updating pulse-incidents index...');
  try {
    const incidentsIndexExists = await client.indices.exists({
      index: 'pulse-incidents',
    });

    if (incidentsIndexExists) {
      console.log('   - Index exists, updating mappings...');
      await client.indices.putMapping({
        index: 'pulse-incidents',
        body: {
          properties: {
            embedding: { type: 'dense_vector', dims: 768 },
            safety_impact_score: { type: 'float' },
            correlation_ids: { type: 'keyword' },
          },
        },
      });
    } else {
      console.log('   - Creating new index...');
      await client.indices.create({
        index: 'pulse-incidents',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              report_type: { type: 'keyword' },
              title: { type: 'text' },
              description: { type: 'text' },
              location: { type: 'geo_point' },
              timestamp: { type: 'date' },
              status: { type: 'keyword' },
              device_id: { type: 'keyword' },
              embedding: { type: 'dense_vector', dims: 768 },
              safety_impact_score: { type: 'float' },
              correlation_ids: { type: 'keyword' },
              metadata: { type: 'object' },
            },
          },
        },
      });
    }
    console.log('   ✅ pulse-incidents ready\n');
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  // 2. Create pulse-helplines index
  console.log('2. Creating pulse-helplines index...');
  try {
    const helplinesExists = await client.indices.exists({
      index: 'pulse-helplines',
    });

    if (!helplinesExists) {
      await client.indices.create({
        index: 'pulse-helplines',
        body: {
          mappings: {
            properties: {
              area_name: { type: 'text' },
              country: { type: 'keyword' },
              location: { type: 'geo_point' },
              helplines: {
                properties: {
                  fire: { type: 'keyword' },
                  medical: { type: 'keyword' },
                  police: { type: 'keyword' },
                  local_fire_dept: { type: 'keyword' },
                  poison_control: { type: 'keyword' },
                  disaster_relief: { type: 'keyword' },
                },
              },
              languages: { type: 'keyword' },
            },
          },
        },
      });
      console.log('   ✅ pulse-helplines created\n');
    } else {
      console.log('   ✅ pulse-helplines already exists\n');
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  // 3. Create pulse-chat-history index
  console.log('3. Creating pulse-chat-history index...');
  try {
    const chatExists = await client.indices.exists({
      index: 'pulse-chat-history',
    });

    if (!chatExists) {
      await client.indices.create({
        index: 'pulse-chat-history',
        body: {
          mappings: {
            properties: {
              session_id: { type: 'keyword' },
              user_id: { type: 'keyword' },
              message: { type: 'text' },
              role: { type: 'keyword' }, // 'user' or 'assistant'
              timestamp: { type: 'date' },
              context: {
                properties: {
                  location: { type: 'geo_point' },
                  nearby_incidents: { type: 'keyword' },
                  query_intent: { type: 'keyword' },
                },
              },
            },
          },
        },
      });
      console.log('   ✅ pulse-chat-history created\n');
    } else {
      console.log('   ✅ pulse-chat-history already exists\n');
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  // 4. Seed helplines data
  console.log('4. Seeding helplines data...');
  try {
    const helplines = [
      {
        area_name: 'San Francisco Bay Area',
        country: 'USA',
        location: { lat: 37.7749, lon: -122.4194 },
        helplines: {
          fire: '911',
          medical: '911',
          police: '911',
          local_fire_dept: '(415) 558-3200',
          poison_control: '1-800-222-1222',
          disaster_relief: '1-800-RED-CROSS',
        },
        languages: ['en', 'es', 'zh'],
      },
      {
        area_name: 'New York City',
        country: 'USA',
        location: { lat: 40.7128, lon: -74.0060 },
        helplines: {
          fire: '911',
          medical: '911',
          police: '911',
          local_fire_dept: '(718) 999-2000',
          poison_control: '1-800-222-1222',
          disaster_relief: '1-800-RED-CROSS',
        },
        languages: ['en', 'es'],
      },
      {
        area_name: 'Los Angeles',
        country: 'USA',
        location: { lat: 34.0522, lon: -118.2437 },
        helplines: {
          fire: '911',
          medical: '911',
          police: '911',
          local_fire_dept: '(213) 485-6185',
          poison_control: '1-800-222-1222',
          disaster_relief: '1-800-RED-CROSS',
        },
        languages: ['en', 'es'],
      },
    ];

    for (const helpline of helplines) {
      await client.index({
        index: 'pulse-helplines',
        document: helpline,
      });
    }
    console.log(`   ✅ Seeded ${helplines.length} helpline entries\n`);
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  console.log('✅ All indices setup complete!');
  console.log('\nYou can now:');
  console.log('- Start reporting incidents');
  console.log('- Use the AI assistant');
  console.log('- Search for helplines by location');
}

setupIndices()
  .catch(console.error)
  .finally(() => process.exit());

