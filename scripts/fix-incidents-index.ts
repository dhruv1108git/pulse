import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  cloud: {
    id: process.env.ELASTIC_CLOUD_ID!,
  },
  auth: {
    apiKey: process.env.ELASTIC_API_KEY!,
  },
});

async function fixIncidentsIndex() {
  console.log('🔧 Fixing pulse-incidents index...\n');

  try {
    // Step 1: Check if it's a data stream and delete it FIRST (templates can't be deleted while in use)
    console.log('Step 1: Checking for data streams...');
    try {
      const dataStreams = await client.indices.getDataStream({
        name: '*pulse-incidents*',
      });
      
      for (const ds of dataStreams.data_streams || []) {
        console.log(`Deleting data stream: ${ds.name}`);
        await client.indices.deleteDataStream({ name: ds.name });
        console.log(`✅ Deleted data stream: ${ds.name}`);
      }
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        console.log('No data streams found');
      }
    }
    
    // Step 2: Now delete templates (after data streams are gone)
    console.log('\nStep 2: Deleting templates...');
    
    try {
      const templates = await client.indices.getIndexTemplate({
        name: '*pulse-incidents*',
      });
      console.log(`Found ${templates.index_templates?.length || 0} index templates`);
      
      for (const template of templates.index_templates || []) {
        console.log(`Deleting index template: ${template.name}`);
        await client.indices.deleteIndexTemplate({ name: template.name });
        console.log(`✅ Deleted template: ${template.name}`);
      }
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        console.log('No index templates found');
      }
    }
    
    try {
      const legacyTemplates = await client.indices.getTemplate({
        name: '*pulse-incidents*',
      });
      
      const templateNames = Object.keys(legacyTemplates);
      console.log(`Found ${templateNames.length} legacy templates`);
      
      for (const templateName of templateNames) {
        console.log(`Deleting legacy template: ${templateName}`);
        await client.indices.deleteTemplate({ name: templateName });
        console.log(`✅ Deleted legacy template: ${templateName}`);
      }
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        console.log('No legacy templates found');
      }
    }
    
    console.log('\nStep 3: Deleting existing index...');
    
    // Step 4: Delete the index itself
    try {
      await client.indices.delete({
        index: 'pulse-incidents',
        ignore_unavailable: true,
      });
      console.log('✅ Index deleted\n');
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        console.log('Index does not exist (this is fine)\n');
      } else {
        throw error;
      }
    }
    
    console.log('Step 4: Creating new index with correct mappings...');
    
    // Step 4: Create fresh index
    await client.indices.create({
      index: 'pulse-incidents',
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
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
            hops: { type: 'integer' },
            first_seen: { type: 'date' },
            embedding: {
              type: 'dense_vector',
              dims: 768,
              index: true,
              similarity: 'cosine',
            },
            safety_impact_score: { type: 'float' },
            correlation_ids: { type: 'keyword' },
            metadata: { type: 'object' },
          },
        },
      },
    });
    
    console.log('✅ pulse-incidents index created successfully!\n');
    
    // Step 5: Verify the mapping
    console.log('Step 5: Verifying index mapping...');
    const mapping = await client.indices.getMapping({ index: 'pulse-incidents' });
    const properties = mapping['pulse-incidents']?.mappings?.properties || {};
    
    const requiredFields = ['id', 'report_type', 'location', 'timestamp', 'embedding'];
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
      if (properties[field]) {
        console.log(`✅ Field '${field}' present (type: ${properties[field].type})`);
      } else {
        console.log(`❌ Field '${field}' missing!`);
        allFieldsPresent = false;
      }
    }
    
    if (allFieldsPresent) {
      console.log('\n✅ All fields verified! NLP search should now work.');
    } else {
      console.log('\n⚠️ Some fields are missing. Check the mapping.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.meta?.body) {
      console.error('Details:', JSON.stringify(error.meta.body, null, 2));
    }
    process.exit(1);
  }
}

fixIncidentsIndex()
  .catch(console.error)
  .finally(() => process.exit());

