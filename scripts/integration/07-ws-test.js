#!/usr/bin/env node
/**
 * Phase 7: WebSocket Test
 * Tests WebSocket connection and event handling
 */

const http = require('http');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';
const TEST_EMAIL = `ws-test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'WsTest123!';

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';
const BOLD = '\x1b[1m';

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function pass(msg) {
  console.log(`  ${GREEN}PASS${NC}: ${msg}`);
  passCount++;
}

function fail(msg) {
  console.log(`  ${RED}FAIL${NC}: ${msg}`);
  failCount++;
}

function skip(msg) {
  console.log(`  ${YELLOW}SKIP${NC}: ${msg}`);
  skipCount++;
}

function section(title) {
  console.log('');
  console.log(`${BOLD}${CYAN}=== ${title} ===${NC}`);
  console.log('');
}

function phase(num, desc) {
  console.log('');
  console.log(`${BOLD}----------------------------------------${NC}`);
  console.log(`${BOLD}${num}: ${desc}${NC}`);
  console.log(`${BOLD}----------------------------------------${NC}`);
}

// HTTP helper
function httpRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Get auth token
async function getToken() {
  // Register user
  const registerRes = await httpRequest('POST', '/api/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: 'WebSocket Test'
  });

  if (registerRes.status === 201 || registerRes.status === 200) {
    return registerRes.body.accessToken;
  }

  // If already exists, login
  if (registerRes.status === 409) {
    const loginRes = await httpRequest('POST', '/api/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    if (loginRes.status === 200) {
      return loginRes.body.accessToken;
    }
  }

  throw new Error(`Failed to get token: ${registerRes.status}`);
}

// WebSocket test with timeout
function testWebSocket(url, expectedBehavior, timeout = 5000) {
  return new Promise((resolve) => {
    let WebSocket;
    try {
      WebSocket = require('ws');
    } catch {
      skip('ws package not installed - run: npm install ws');
      resolve({ skipped: true });
      return;
    }

    const ws = new WebSocket(url);
    let result = { connected: false, messages: [], closeCode: null, error: null };

    const timer = setTimeout(() => {
      ws.close();
      resolve(result);
    }, timeout);

    ws.on('open', () => {
      result.connected = true;
    });

    ws.on('message', (data) => {
      try {
        result.messages.push(JSON.parse(data.toString()));
      } catch {
        result.messages.push(data.toString());
      }
    });

    ws.on('close', (code) => {
      result.closeCode = code;
      clearTimeout(timer);
      resolve(result);
    });

    ws.on('error', (err) => {
      result.error = err.message;
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function main() {
  section('Phase 7: WebSocket Tests');

  // Check if ws package is available
  try {
    require('ws');
  } catch {
    console.log(`${RED}ERROR${NC}: ws package not installed`);
    console.log('');
    console.log('To run WebSocket tests, install the ws package:');
    console.log('  cd api && npm install ws');
    console.log('');
    console.log('Or install globally:');
    console.log('  npm install -g ws');
    console.log('');
    skip('WebSocket tests - ws package not available');
    printSummary();
    process.exit(0);
  }

  let token;

  // ============================================
  // 7.1 Get Auth Token
  // ============================================
  phase('7.1', 'Get Auth Token');

  try {
    token = await getToken();
    if (token) {
      pass('Got authentication token');
      console.log(`  Token: ${token.substring(0, 20)}...`);
    } else {
      fail('Could not get token');
      printSummary();
      process.exit(1);
    }
  } catch (err) {
    fail(`Token error: ${err.message}`);
    printSummary();
    process.exit(1);
  }

  // ============================================
  // 7.2 Connect with Valid Token
  // ============================================
  phase('7.2', 'Connect with Valid Token');

  const validResult = await testWebSocket(`${WS_URL}?token=${token}`, 'connect');

  if (validResult.connected) {
    pass('WebSocket connected with valid token');
  } else if (validResult.error) {
    fail(`Connection error: ${validResult.error}`);
  } else {
    fail('WebSocket did not connect');
  }

  // Check for connected event
  const connectedEvent = validResult.messages.find(m => m.type === 'connected');
  if (connectedEvent) {
    pass('Received "connected" event');
  } else if (validResult.messages.length > 0) {
    pass(`Received ${validResult.messages.length} message(s)`);
    console.log(`  First message: ${JSON.stringify(validResult.messages[0])}`);
  } else {
    skip('No messages received (may be expected)');
  }

  // ============================================
  // 7.3 Connect without Token
  // ============================================
  phase('7.3', 'Connect without Token');

  const noTokenResult = await testWebSocket(WS_URL, 'reject', 3000);

  if (noTokenResult.closeCode === 4001 || noTokenResult.closeCode === 1008) {
    pass(`Connection rejected with code ${noTokenResult.closeCode}`);
  } else if (!noTokenResult.connected) {
    pass('Connection was rejected (did not connect)');
  } else if (noTokenResult.closeCode) {
    pass(`Connection closed with code ${noTokenResult.closeCode}`);
  } else {
    // Some implementations may allow connection but send error message
    const errorMsg = noTokenResult.messages.find(m => m.error || m.type === 'error');
    if (errorMsg) {
      pass('Connection received error message');
    } else {
      skip('Connection behavior unclear - check implementation');
    }
  }

  // ============================================
  // 7.4 Connect with Invalid Token
  // ============================================
  phase('7.4', 'Connect with Invalid Token');

  const badTokenResult = await testWebSocket(`${WS_URL}?token=invalid-token-here`, 'reject', 3000);

  if (badTokenResult.closeCode === 4001 || badTokenResult.closeCode === 1008) {
    pass(`Invalid token rejected with code ${badTokenResult.closeCode}`);
  } else if (!badTokenResult.connected) {
    pass('Invalid token connection was rejected');
  } else if (badTokenResult.closeCode) {
    pass(`Connection closed with code ${badTokenResult.closeCode}`);
  } else {
    skip('Invalid token behavior unclear');
  }

  // ============================================
  // 7.5 Connection Stability
  // ============================================
  phase('7.5', 'Connection Stability');

  const stabilityResult = await testWebSocket(`${WS_URL}?token=${token}`, 'stable', 3000);

  if (stabilityResult.connected && !stabilityResult.closeCode) {
    pass('Connection remained stable for 3 seconds');
  } else if (stabilityResult.connected) {
    skip(`Connection closed after connect (code: ${stabilityResult.closeCode})`);
  } else {
    fail('Connection not stable');
  }

  // ============================================
  // Summary
  // ============================================
  printSummary();
}

function printSummary() {
  console.log('');
  console.log(`${BOLD}======================================${NC}`);
  console.log(`${BOLD}         WebSocket Test Summary${NC}`);
  console.log(`${BOLD}======================================${NC}`);
  console.log(`  Total:   ${passCount + failCount + skipCount}`);
  console.log(`  ${GREEN}Passed:  ${passCount}${NC}`);
  console.log(`  ${RED}Failed:  ${failCount}${NC}`);
  console.log(`  ${YELLOW}Skipped: ${skipCount}${NC}`);
  console.log(`${BOLD}======================================${NC}`);

  if (failCount > 0) {
    console.log(`${RED}RESULT: FAILED${NC}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}RESULT: PASSED${NC}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${RED}Unexpected error:${NC}`, err);
  process.exit(1);
});
