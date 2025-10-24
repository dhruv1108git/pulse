/**
 * System Setup Verification
 * Validates environment, indices, and connections
 */

import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface Check {
  name: string;
  passed: boolean;
  message?: string;
}

const checks: Check[] = [];

function check(name: string, passed: boolean, message?: string) {
  checks.push({ name, passed, message });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (message) {
    console.log(`   ${message}`);
  }
}

async function verifySetup() {
  console.log('🔍 Verifying Pulse System Setup\n');
  console.log('=' .repeat(60));
  
  // 1. Environment Variables
  console.log('\n1️⃣  Checking Environment Variables...\n');
  
  const requiredEnvVars = [
    'ELASTIC_CLOUD_ID',
    'ELASTIC_API_KEY',
    'VERTEX_AI_PROJECT_ID',
    'VERTEX_AI_LOCATION',
    'GOOGLE_APPLICATION_CREDENTIALS',
  ];
  
  requiredEnvVars.forEach((varName) => {
    const value = process.env[varName];
    check(
      varName,
      !!value,
      value ? `Set (${value.substring(0, 20)}...)` : 'Missing!'
    );
  });
  
  // Optional but recommended
  const optionalVars = ['SERPAPI_KEY', 'AI_SERVICE_PORT', 'API_PORT'];
  console.log('\n   Optional Variables:');
  optionalVars.forEach((varName) => {
    const value = process.env[varName];
    const status = value ? '✅' : '⚠️ ';
    console.log(`   ${status} ${varName}: ${value || 'Not set (using defaults)'}`);
  });
  
  // 2. Google Cloud Credentials
  console.log('\n2️⃣  Checking Google Cloud Credentials...\n');
  
  const gcpKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gcpKeyPath) {
    const keyExists = fs.existsSync(gcpKeyPath);
    check(
      'GCP Service Account Key',
      keyExists,
      keyExists ? `Found at ${gcpKeyPath}` : `File not found at ${gcpKeyPath}`
    );
    
    if (keyExists) {
      try {
        const keyContent = JSON.parse(fs.readFileSync(gcpKeyPath, 'utf-8'));
        check(
          'GCP Key Format',
          !!keyContent.project_id && !!keyContent.private_key,
          `Project: ${keyContent.project_id}`
        );
      } catch (error) {
        check('GCP Key Format', false, 'Invalid JSON format');
      }
    }
  } else {
    check('GCP Service Account Key', false, 'GOOGLE_APPLICATION_CREDENTIALS not set');
  }
  
  // 3. Elasticsearch Connection
  console.log('\n3️⃣  Testing Elasticsearch Connection...\n');
  
  try {
    const client = new Client({
      cloud: {
        id: process.env.ELASTIC_CLOUD_ID!,
      },
      auth: {
        apiKey: process.env.ELASTIC_API_KEY!,
      },
    });
    
    const pingResult = await client.ping();
    check('Elasticsearch Connection', pingResult, 'Successfully connected');
    
    // 4. Check Indices
    console.log('\n4️⃣  Checking Elasticsearch Indices...\n');
    
    const requiredIndices = [
      'pulse-incidents',
      'pulse-helplines',
      'pulse-helplines-cache',
      'pulse-chat-history',
    ];
    
    for (const indexName of requiredIndices) {
      try {
        const exists = await client.indices.exists({ index: indexName });
        
        if (exists) {
          // Get index stats
          const stats = await client.indices.stats({ index: indexName });
          const docCount = stats.indices?.[indexName]?.total?.docs?.count || 0;
          
          check(
            `Index: ${indexName}`,
            true,
            `Exists (${docCount} documents)`
          );
        } else {
          check(`Index: ${indexName}`, false, 'Index does not exist!');
        }
      } catch (error) {
        check(
          `Index: ${indexName}`,
          false,
          error instanceof Error ? error.message : 'Error checking index'
        );
      }
    }
    
    // 5. Verify Index Mappings
    console.log('\n5️⃣  Verifying Index Mappings...\n');
    
    try {
      const incidentMapping = await client.indices.getMapping({
        index: 'pulse-incidents',
      });
      
      const properties =
        incidentMapping['pulse-incidents']?.mappings?.properties || {};
      
      const requiredFields = [
        'id',
        'report_type',
        'location',
        'timestamp',
        'embedding',
      ];
      
      requiredFields.forEach((field) => {
        check(
          `Incidents field: ${field}`,
          !!properties[field],
          properties[field]
            ? `Type: ${properties[field].type}`
            : 'Field missing!'
        );
      });
    } catch (error) {
      check('Index Mappings', false, 'Could not verify mappings');
    }
    
  } catch (error) {
    check(
      'Elasticsearch Connection',
      false,
      error instanceof Error ? error.message : 'Connection failed'
    );
  }
  
  // 6. AI Service Check
  console.log('\n6️⃣  Checking AI Service...\n');
  
  const aiServiceUrl =
    process.env.AI_SERVICE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5001';
  
  try {
    const response = await fetch(`${aiServiceUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const data = await response.json();
      check('AI Service Health', true, `Status: ${data.status}`);
      check(
        'Elastic Connection',
        data.elastic_connected,
        data.elastic_connected ? 'Connected' : 'Not connected'
      );
      check(
        'Vertex AI Config',
        data.vertex_ai_configured,
        data.vertex_ai_configured ? 'Configured' : 'Not configured'
      );
    } else {
      check('AI Service Health', false, `HTTP ${response.status}`);
    }
  } catch (error) {
    check(
      'AI Service Health',
      false,
      'Service not running or not reachable. Start with: cd pulse-ai-service && python app/main.py'
    );
  }
  
  // Print Summary
  printSummary();
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 VERIFICATION SUMMARY\n');
  
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  const total = checks.length;
  
  console.log(`Total Checks:   ${total}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ❌`);
  console.log(`Success Rate:   ${Math.round((passed / total) * 100)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Checks:');
    checks
      .filter((c) => !c.passed)
      .forEach((c) => {
        console.log(`   - ${c.name}`);
        if (c.message) {
          console.log(`     ${c.message}`);
        }
      });
    
    console.log('\n📝 Action Items:');
    
    const missingEnv = checks.filter(
      (c) => !c.passed && c.name.includes('ELASTIC_') || c.name.includes('VERTEX_')
    );
    if (missingEnv.length > 0) {
      console.log('   1. Set missing environment variables in .env file');
    }
    
    const missingIndices = checks.filter(
      (c) => !c.passed && c.name.includes('Index:')
    );
    if (missingIndices.length > 0) {
      console.log('   2. Run index setup scripts:');
      console.log('      npx tsx scripts/setup-elastic-indices.ts');
      console.log('      npx tsx scripts/setup-helplines-cache.ts');
    }
    
    const serviceDown = checks.find(
      (c) => !c.passed && c.name === 'AI Service Health'
    );
    if (serviceDown) {
      console.log('   3. Start AI Service:');
      console.log('      cd pulse-ai-service');
      console.log('      source venv/bin/activate');
      console.log('      python app/main.py');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('\n🎉 ALL CHECKS PASSED! System is properly configured.\n');
    console.log('Next steps:');
    console.log('  1. Start AI Service: cd pulse-ai-service && python app/main.py');
    console.log('  2. Test endpoints: npx tsx scripts/test-all-endpoints.ts');
    console.log('  3. Run mobile app: cd pulse-mobile && npx react-native run-ios\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SETUP INCOMPLETE. Please address failed checks above.\n');
    process.exit(1);
  }
}

// Run verification
verifySetup().catch((error) => {
  console.error('\n❌ Verification failed:', error);
  process.exit(1);
});

