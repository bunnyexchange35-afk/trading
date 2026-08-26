/**
 * Test script for Account Documents feature
 * Run this to verify the implementation works correctly
 */

const API_BASE = 'http://localhost:8080';

async function testEndpoint(endpoint, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response keys: ${Object.keys(data).join(', ')}`);
      return data;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function testWithAuth(endpoint, description, token) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response keys: ${Object.keys(data).join(', ')}`);
      return data;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Account Documents Feature Tests\n');
  console.log('=' .repeat(60));
  
  // Test 1: Health check
  await testEndpoint('/api/health', 'Health Check');
  
  // Test 2: API Index
  const apiIndex = await testEndpoint('/api', 'API Index');
  if (apiIndex) {
    console.log('\n📋 Available endpoints:');
    console.log(JSON.stringify(apiIndex.endpoints.account, null, 2));
  }
  
  // Test 3: Register a test user
  console.log('\n📝 Registering test user...');
  const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      preferredCurrency: 'INR',
      inviteCode: 'MUDREXX-ADMIN', // Using admin code for testing
    }),
  });
  
  const registerData = await registerResponse.json();
  let token = null;
  
  if (registerData.success) {
    console.log('   ✅ User registered successfully');
    token = registerData.token;
    console.log(`   🔑 Token: ${token.substring(0, 20)}...`);
  } else {
    console.log('   ⚠️  User might already exist, trying login...');
    
    // Try login instead
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    
    const loginData = await loginResponse.json();
    if (loginData.success) {
      console.log('   ✅ Login successful');
      token = loginData.token;
    } else {
      console.log('   ❌ Failed to get token');
      return;
    }
  }
  
  // Test 4: Account Statement
  console.log('\n' + '=' .repeat(60));
  const statement = await testWithAuth(
    '/api/account/statement?email=test@example.com',
    'Account Statement',
    token
  );
  
  if (statement) {
    console.log('\n📊 Statement Summary:');
    console.log(`   Statement ID: ${statement.statement?.statementId}`);
    console.log(`   Account Holder: ${statement.statement?.accountHolder?.name}`);
    console.log(`   Total Transactions: ${statement.statement?.summary?.totalTransactions}`);
    console.log(`   Real Balance: ₹${statement.statement?.balances?.realBalance?.toLocaleString()}`);
    console.log(`   Demo Balance: ${statement.statement?.balances?.demoBalance?.toLocaleString()} credits`);
  }
  
  // Test 5: Account Proof
  console.log('\n' + '=' .repeat(60));
  const proof = await testWithAuth(
    '/api/account/proof?email=test@example.com',
    'Account Proof',
    token
  );
  
  if (proof) {
    console.log('\n🛡️ Proof Summary:');
    console.log(`   Proof ID: ${proof.proof?.proofId}`);
    console.log(`   Account Holder: ${proof.proof?.accountHolder?.name}`);
    console.log(`   Account Active: ${proof.proof?.accountStatus?.isActive}`);
    console.log(`   Account Verified: ${proof.proof?.accountStatus?.isVerified}`);
    console.log(`   Valid Until: ${new Date(proof.proof?.validUntil).toLocaleDateString()}`);
  }
  
  // Test 6: Account Agreement
  console.log('\n' + '=' .repeat(60));
  const agreement = await testWithAuth(
    '/api/account/agreement?email=test@example.com',
    'Account Agreement',
    token
  );
  
  if (agreement) {
    console.log('\n📜 Agreement Summary:');
    console.log(`   Agreement ID: ${agreement.agreement?.agreementId}`);
    console.log(`   Account Holder: ${agreement.agreement?.accountHolder?.name}`);
    console.log(`   Terms Version: ${agreement.agreement?.terms?.version}`);
    console.log(`   Sections: ${agreement.agreement?.terms?.sections?.length}`);
    console.log(`   Has Accepted: ${agreement.agreement?.userAcceptance?.hasAccepted}`);
  }
  
  // Test 7: Verify all endpoints are protected
  console.log('\n' + '=' .repeat(60));
  console.log('\n🔒 Testing Authentication Protection:');
  
  const protectedEndpoints = [
    '/api/account/statement?email=test@example.com',
    '/api/account/proof?email=test@example.com',
    '/api/account/agreement?email=test@example.com',
  ];
  
  for (const endpoint of protectedEndpoints) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    const data = await response.json();
    
    if (response.status === 401) {
      console.log(`   ✅ ${endpoint.split('?')[0]} - Protected (401)`);
    } else {
      console.log(`   ❌ ${endpoint.split('?')[0]} - Not protected (${response.status})`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n✨ All tests completed!');
  console.log('\n📝 Notes:');
  console.log('   - Account documents are generated in real-time');
  console.log('   - PDF generation happens on the client side');
  console.log('   - All endpoints require authentication');
  console.log('   - Documents include comprehensive account data');
  console.log('\n🎯 Next Steps:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Login to the application');
  console.log('   3. Go to Profile page');
  console.log('   4. Scroll down to "Account Documents" section');
  console.log('   5. Click download buttons to generate PDFs');
}

// Run tests
runTests().catch(console.error);
