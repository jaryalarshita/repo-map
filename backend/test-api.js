// =============================================================================
// test-api.js — API Endpoint Integration Test
// =============================================================================
// USAGE:  First start the server:  node server.js
//         Then in another terminal: node test-api.js
//
// This script:
//   1. Pings the health check endpoint
//   2. Posts a real GitHub URL to /api/analyze (downloads + parses a real repo)
//   3. Logs the first 3 nodes returned
//
// ⚠️  WARNING: The real /api/analyze test downloads a GitHub repo as a ZIP.
//    Using a small repo (expressjs/express) to keep it fast (~5-10 seconds).
//    For torvalds/linux, expect 30-60+ seconds and a massive JSON response.
// =============================================================================

const API_BASE = 'http://localhost:3001/api';

async function runTests() {
  console.log('');
  console.log('==========================================');
  console.log('  API Endpoint Integration Tests');
  console.log('==========================================');
  console.log('');

  // -----------------------------------------------------------------------
  // Test 1: Health Check
  // -----------------------------------------------------------------------
  console.log('🏓 Test 1: Ping health check...');

  try {
    const pingRes = await fetch(`${API_BASE}/analyze/ping`);
    const pingData = await pingRes.json();

    if (pingData.status === 'ok') {
      console.log('   ✅ Ping returned:', JSON.stringify(pingData));
    } else {
      console.log('   ❌ Unexpected ping response:', pingData);
      process.exit(1);
    }
  } catch (err) {
    console.log('   ❌ Server not reachable. Is it running? (node server.js)');
    console.log('   Error:', err.message);
    process.exit(1);
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Test 2: Input Validation (should return 400)
  // -----------------------------------------------------------------------
  console.log('🛡️  Test 2: Input validation (missing URL)...');

  const validationRes = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  if (validationRes.status === 400) {
    const valData = await validationRes.json();
    console.log('   ✅ Correctly returned 400:', valData.error);
  } else {
    console.log('   ❌ Expected 400, got:', validationRes.status);
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Test 3: Real Repository Analysis
  // -----------------------------------------------------------------------
  // Using a small repo to keep the test fast.
  // Change to "https://github.com/torvalds/linux" for a stress test.
  const testUrl = 'https://github.com/expressjs/express';

  console.log(`🔬 Test 3: Real repo analysis (${testUrl})...`);
  console.log('   ⏳ This downloads the ZIP and runs C++ parser — may take 10-30s...');
  console.log('');

  const startTime = Date.now();

  try {
    const analyzeRes = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: testUrl })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!analyzeRes.ok) {
      const errData = await analyzeRes.json();
      console.log(`   ❌ Server returned ${analyzeRes.status}:`, errData);
      process.exit(1);
    }

    const graphData = await analyzeRes.json();

    console.log(`   ⏱️  Completed in ${elapsed}s`);
    console.log(`   📊 Total: ${graphData.nodes.length} nodes, ${graphData.links.length} links`);
    console.log('');
    console.log('   First 3 nodes:');

    graphData.nodes.slice(0, 3).forEach((node, i) => {
      console.log(`     ${i + 1}. ${node.id} (label: ${node.label}, size: ${node.size})`);
    });

    console.log('');

    if (graphData.nodes.length > 0) {
      console.log('   ✅ API integration test PASSED');
    } else {
      console.log('   ❌ No nodes returned — parser may have failed');
      process.exit(1);
    }

  } catch (err) {
    console.log('   ❌ Request failed:', err.message);
    process.exit(1);
  }

  console.log('');
  console.log('==========================================');
  console.log('  All API tests passed! 🎉');
  console.log('==========================================');
  console.log('');
}

runTests();
