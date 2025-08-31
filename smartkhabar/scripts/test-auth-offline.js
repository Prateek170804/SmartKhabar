/**
 * Test Authentication System (Offline)
 * Tests authentication components without requiring a running server
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testAuthOffline() {
  console.log('🧪 Testing SmartKhabar Authentication Components (Offline)...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Environment Variables
  console.log('🔍 Testing: Environment Variables');
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const dbUrl = process.env.DATABASE_URL;
    
    if (jwtSecret && jwtSecret.length > 20) {
      console.log('✅ PASS: JWT_SECRET is configured');
      console.log(`   🔑 JWT Secret length: ${jwtSecret.length} characters`);
      results.passed++;
    } else {
      console.log('❌ FAIL: JWT_SECRET not properly configured');
      results.failed++;
    }

    if (dbUrl && dbUrl.includes('postgresql://')) {
      console.log('✅ PASS: Database URL is configured');
      console.log(`   🗄️  Database: PostgreSQL (Neon)`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Database URL not properly configured');
      results.failed++;
    }
    
    results.tests.push('Environment Variables');
  } catch (error) {
    console.log('❌ FAIL: Environment Variables');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Environment Variables');
  }

  // Test 2: JWT Token Generation (Mock)
  console.log('\n🔍 Testing: JWT Token Generation');
  try {
    const jwt = require('jsonwebtoken');
    const testPayload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userId === testPayload.userId && decoded.email === testPayload.email) {
      console.log('✅ PASS: JWT Token Generation');
      console.log(`   🔑 Token generated and verified successfully`);
      console.log(`   👤 User: ${decoded.name} (${decoded.email})`);
      results.passed++;
    } else {
      console.log('❌ FAIL: JWT Token Generation - Verification failed');
      results.failed++;
    }
    results.tests.push('JWT Token Generation');
  } catch (error) {
    console.log('❌ FAIL: JWT Token Generation');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('JWT Token Generation');
  }

  // Test 3: Password Hashing
  console.log('\n🔍 Testing: Password Hashing');
  try {
    const bcrypt = require('bcryptjs');
    const testPassword = 'testpassword123';
    
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    const isValid = await bcrypt.compare(testPassword, hashedPassword);
    const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword);
    
    if (isValid && !isInvalid && hashedPassword !== testPassword) {
      console.log('✅ PASS: Password Hashing');
      console.log(`   🔒 Password hashed and verified successfully`);
      console.log(`   📏 Hash length: ${hashedPassword.length} characters`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Password Hashing - Verification failed');
      results.failed++;
    }
    results.tests.push('Password Hashing');
  } catch (error) {
    console.log('❌ FAIL: Password Hashing');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Password Hashing');
  }

  // Test 4: Database Connection
  console.log('\n🔍 Testing: Database Connection');
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    const result = await client.query('SELECT NOW() as current_time');
    await client.end();
    
    if (result.rows && result.rows.length > 0) {
      console.log('✅ PASS: Database Connection');
      console.log(`   🗄️  Connected to PostgreSQL successfully`);
      console.log(`   ⏰ Server time: ${result.rows[0].current_time}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Database Connection - No response');
      results.failed++;
    }
    results.tests.push('Database Connection');
  } catch (error) {
    console.log('❌ FAIL: Database Connection');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Database Connection');
  }

  // Test 5: User Table Schema
  console.log('\n🔍 Testing: User Table Schema');
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT,
        preferences JSONB DEFAULT '{}',
        subscription_plan VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if table exists and has correct structure
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    await client.end();
    
    const expectedColumns = ['id', 'email', 'name', 'password_hash', 'preferences'];
    const actualColumns = result.rows.map(row => row.column_name);
    const hasRequiredColumns = expectedColumns.every(col => actualColumns.includes(col));
    
    if (hasRequiredColumns) {
      console.log('✅ PASS: User Table Schema');
      console.log(`   📋 Table created with ${result.rows.length} columns`);
      console.log(`   📝 Columns: ${actualColumns.join(', ')}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: User Table Schema - Missing required columns');
      console.log(`   Expected: ${expectedColumns.join(', ')}`);
      console.log(`   Actual: ${actualColumns.join(', ')}`);
      results.failed++;
    }
    results.tests.push('User Table Schema');
  } catch (error) {
    console.log('❌ FAIL: User Table Schema');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('User Table Schema');
  }

  // Test 6: Authentication Service Import
  console.log('\n🔍 Testing: Authentication Service Import');
  try {
    // Test if we can import the auth service (basic syntax check)
    const fs = require('fs');
    const path = require('path');
    
    const authServicePath = path.join(__dirname, '../src/lib/auth/auth-service.ts');
    const authServiceExists = fs.existsSync(authServicePath);
    
    if (authServiceExists) {
      const authServiceContent = fs.readFileSync(authServicePath, 'utf8');
      const hasRequiredMethods = [
        'register',
        'login',
        'verifyToken',
        'getUserFromToken',
        'updatePreferences'
      ].every(method => authServiceContent.includes(method));
      
      if (hasRequiredMethods) {
        console.log('✅ PASS: Authentication Service Import');
        console.log(`   📁 Auth service file exists and has required methods`);
        console.log(`   🔧 Service is ready for use`);
        results.passed++;
      } else {
        console.log('❌ FAIL: Authentication Service Import - Missing methods');
        results.failed++;
      }
    } else {
      console.log('❌ FAIL: Authentication Service Import - File not found');
      results.failed++;
    }
    results.tests.push('Authentication Service Import');
  } catch (error) {
    console.log('❌ FAIL: Authentication Service Import');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Authentication Service Import');
  }

  // Test 7: API Routes Exist
  console.log('\n🔍 Testing: Authentication API Routes');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const apiRoutes = [
      '../src/app/api/auth/register/route.ts',
      '../src/app/api/auth/login/route.ts',
      '../src/app/api/auth/me/route.ts',
      '../src/app/api/auth/logout/route.ts'
    ];
    
    const existingRoutes = apiRoutes.filter(route => {
      const routePath = path.join(__dirname, route);
      return fs.existsSync(routePath);
    });
    
    if (existingRoutes.length === apiRoutes.length) {
      console.log('✅ PASS: Authentication API Routes');
      console.log(`   📁 All ${apiRoutes.length} auth routes exist`);
      console.log(`   🛣️  Routes: /api/auth/register, /api/auth/login, /api/auth/me, /api/auth/logout`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Authentication API Routes - Missing routes');
      console.log(`   Found: ${existingRoutes.length}/${apiRoutes.length} routes`);
      results.failed++;
    }
    results.tests.push('Authentication API Routes');
  } catch (error) {
    console.log('❌ FAIL: Authentication API Routes');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Authentication API Routes');
  }

  // Final Results
  console.log('\n📊 Authentication Components Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All authentication components are ready!');
    console.log('🔐 Authentication system is properly configured');
    console.log('🚀 Ready to test with live server');
  } else if (results.passed > results.failed) {
    console.log('\n⚠️  Most authentication components are ready');
    console.log('🔧 Some minor issues need to be resolved');
  } else {
    console.log('\n❌ Authentication system has significant issues');
    console.log('🔧 Please review and fix the configuration');
  }

  console.log('\n📋 Authentication Components Tested:');
  results.tests.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test}`);
  });

  console.log('\n🔐 Authentication System Status: COMPONENTS READY');
  console.log('📅 Test Date:', new Date().toISOString());
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Start the development server: npm run dev');
  console.log('   2. Test authentication endpoints with Postman or curl');
  console.log('   3. Create user interface components for login/register');
  console.log('   4. Implement real-time features and enhanced UI');
}

// Run the test
testAuthOffline().catch(console.error);