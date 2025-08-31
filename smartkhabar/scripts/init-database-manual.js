#!/usr/bin/env node

/**
 * Manual Database Initialization Script
 */

require('dotenv').config({ path: '.env.local' });
const { getNeonClient } = require('../src/lib/database/neon-client.ts');

async function initializeDatabase() {
  console.log('🔧 Initializing database tables...');
  
  try {
    const client = getNeonClient();
    await client.initializeTables();
    console.log('✅ Database tables initialized successfully!');
    
    // Test the connection
    const health = await client.getHealthStatus();
    console.log('🏥 Database health:', health.status);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}