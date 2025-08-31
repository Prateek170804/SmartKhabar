#!/usr/bin/env node

/**
 * Database Connection Test Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function testDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔍 Testing database connection...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('   Current time:', result.rows[0].current_time);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testDatabase();
}