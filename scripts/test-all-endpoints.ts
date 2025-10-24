/**
 * Automated API Endpoint Testing
 * Tests all Pulse AI Service endpoints with validation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE_URL = process.env.AI_SERVICE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5001';

interface TestResult {
  name: string;
  passed: boolean;
  responseTime: number;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {},
  validator?: (data: any) => boolean
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name,
        passed: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    // Run validator if provided
    if (validator && !validator(data)) {
      return {
        name,
        passed: false,
        responseTime,
        error: 'Response validation failed',
      };
    }
    
    return {
      name,
      passed: true,
      responseTime,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runTests() {
  console.log('🧪 Starting Automated API Tests\n');
  console.log(`Testing: ${API_BASE_URL}\n`);
  console.log('=' .repeat(60));
  
  // 1. Health Check
  console.log('\n1️⃣  Testing Health Check...');
  const healthResult = await testEndpoint(
    'Health Check',
    `${API_BASE_URL}/health`,
    {},
    (data) => data.status === 'healthy'
  );
  results.push(healthResult);
  printResult(healthResult);
  
  // 2. Root Endpoint
  console.log('\n2️⃣  Testing Root Endpoint...');
  const rootResult = await testEndpoint(
    'Root Endpoint',
    `${API_BASE_URL}/`,
    {},
    (data) => data.name === 'Pulse AI Service'
  );
  results.push(rootResult);
  printResult(rootResult);
  
  // 3. AI Chat
  console.log('\n3️⃣  Testing AI Chat...');
  const chatResult = await testEndpoint(
    'AI Chat',
    `${API_BASE_URL}/api/assistant/chat`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello, what can you do?',
        location: { lat: 37.7749, lon: -122.4194 },
      }),
    },
    (data) => data.success && data.data?.response
  );
  results.push(chatResult);
  printResult(chatResult);
  
  // 4. Smart Helplines (cache miss)
  console.log('\n4️⃣  Testing Smart Helplines (first request)...');
  const location = `Test-City-${Date.now()}`;
  const helplinesResult1 = await testEndpoint(
    'Smart Helplines (Cache Miss)',
    `${API_BASE_URL}/api/helplines/smart?location=${encodeURIComponent(location)}`,
    {},
    (data) => data.success || data.data
  );
  results.push(helplinesResult1);
  printResult(helplinesResult1);
  
  // 5. Smart Helplines (cache hit)
  console.log('\n5️⃣  Testing Smart Helplines (cache hit)...');
  const helplinesResult2 = await testEndpoint(
    'Smart Helplines (Cache Hit)',
    `${API_BASE_URL}/api/helplines/smart?location=San%20Francisco,%20CA`,
    {},
    (data) => data.success || data.data
  );
  results.push(helplinesResult2);
  printResult(helplinesResult2);
  
  // 6. Helplines Cache Stats
  console.log('\n6️⃣  Testing Cache Stats...');
  const cacheStatsResult = await testEndpoint(
    'Helplines Cache Stats',
    `${API_BASE_URL}/api/helplines/cache/stats`,
    {},
    (data) => data.success && data.stats
  );
  results.push(cacheStatsResult);
  printResult(cacheStatsResult);
  
  // 7. NLP Search
  console.log('\n7️⃣  Testing NLP Search...');
  const nlpSearchResult = await testEndpoint(
    'NLP Search',
    `${API_BASE_URL}/api/incidents/nlp-search?q=fires&limit=5`,
    {},
    (data) => data.success || data.data
  );
  results.push(nlpSearchResult);
  printResult(nlpSearchResult);
  
  // 8. Safety Score
  console.log('\n8️⃣  Testing Safety Score...');
  const safetyScoreResult = await testEndpoint(
    'Safety Score',
    `${API_BASE_URL}/api/insights/safety-score?lat=37.7749&lon=-122.4194&time_range=7d`,
    {},
    (data) => data.success || data.data
  );
  results.push(safetyScoreResult);
  printResult(safetyScoreResult);
  
  // 9. Trends
  console.log('\n9️⃣  Testing Trends...');
  const trendsResult = await testEndpoint(
    'Trends',
    `${API_BASE_URL}/api/insights/trends?interval=1h&time_range=24h`,
    {},
    (data) => data.success || data.data
  );
  results.push(trendsResult);
  printResult(trendsResult);
  
  // 10. Hotspots
  console.log('\n🔟 Testing Hotspots...');
  const hotspotsResult = await testEndpoint(
    'Hotspots',
    `${API_BASE_URL}/api/insights/hotspots?precision=5&time_range=7d`,
    {},
    (data) => data.success || data.data
  );
  results.push(hotspotsResult);
  printResult(hotspotsResult);
  
  // 11. Summary Stats
  console.log('\n1️⃣1️⃣  Testing Summary Stats...');
  const summaryResult = await testEndpoint(
    'Summary Stats',
    `${API_BASE_URL}/api/insights/summary`,
    {},
    (data) => data.success || data.data
  );
  results.push(summaryResult);
  printResult(summaryResult);
  
  // 12. Nearby Helplines (static)
  console.log('\n1️⃣2️⃣  Testing Nearby Helplines (static)...');
  const nearbyResult = await testEndpoint(
    'Nearby Helplines',
    `${API_BASE_URL}/api/helplines/nearby?lat=37.7749&lon=-122.4194`,
    {},
    (data) => data.success || data.data
  );
  results.push(nearbyResult);
  printResult(nearbyResult);
  
  // 13. Relay Query - Assistant
  console.log('\n1️⃣3️⃣  Testing Relay Query (Assistant)...');
  const assistantQueryId = `test-query-${Date.now()}`;
  const relayAssistantResult = await testEndpoint(
    'Relay Query - Assistant',
    `${API_BASE_URL}/api/relay/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        query_id: assistantQueryId,
        query_text: 'What emergency services are available?',
        query_type: 'assistant',
        user_location: { lat: 37.7749, lon: -122.4194 },
        original_device: 'test-device-123',
        relayed_by: 'test-device-123',
      }),
    },
    (data) => data.success && data.response
  );
  results.push(relayAssistantResult);
  printResult(relayAssistantResult);
  
  // 14. Relay Query Check
  console.log('\n1️⃣4️⃣  Testing Relay Query Check...');
  const relayCheckResult = await testEndpoint(
    'Relay Query Check',
    `${API_BASE_URL}/api/relay/check?query_id=${assistantQueryId}`,
    {},
    (data) => data.success || (data.status && data.status !== 'not_found')
  );
  results.push(relayCheckResult);
  printResult(relayCheckResult);
  
  // 15. Relay Query - SOS
  console.log('\n1️⃣5️⃣  Testing Relay Query (SOS)...');
  const sosQueryId = `test-sos-${Date.now()}`;
  const relaySOSResult = await testEndpoint(
    'Relay Query - SOS',
    `${API_BASE_URL}/api/relay/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        query_id: sosQueryId,
        query_text: 'SOS: medical emergency',
        query_type: 'sos',
        user_location: { lat: 37.7749, lon: -122.4194 },
        original_device: 'test-device-123',
        relayed_by: 'test-device-123',
        sos_data: {
          incident_type: 'medical',
          description: 'Test medical emergency',
          user_name: 'Test User',
        },
      }),
    },
    (data) => data.success && data.emergency_type
  );
  results.push(relaySOSResult);
  printResult(relaySOSResult);
  
  // Print Summary
  printSummary();
}

function printResult(result: TestResult) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  const time = `${result.responseTime}ms`;
  
  console.log(`   ${status} - ${result.name} (${time})`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');
  
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const avgTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTime, 0) / total
  );
  
  console.log(`Total Tests:    ${total}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ❌`);
  console.log(`Success Rate:   ${Math.round((passed / total) * 100)}%`);
  console.log(`Avg Response:   ${avgTime}ms`);
  
  // Performance warnings
  console.log('\n⚡ Performance Check:');
  const slowTests = results.filter((r) => r.responseTime > 2000);
  if (slowTests.length > 0) {
    console.log(`   ⚠️  ${slowTests.length} test(s) > 2s response time:`);
    slowTests.forEach((t) => {
      console.log(`      - ${t.name}: ${t.responseTime}ms`);
    });
  } else {
    console.log('   ✅ All tests under 2s');
  }
  
  // Failed tests detail
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}`);
        console.log(`     Error: ${r.error}`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for demo.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Please fix issues before demo.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

