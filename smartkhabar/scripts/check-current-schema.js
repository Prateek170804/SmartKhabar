#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkCurrentSchema() {
  console.log('🔍 Checking Current Database Schema');
  console.log('===================================');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check existing tables
    const tablesResult = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position
    `);

    console.log('\n📊 Current Database Schema:');
    let currentTable = '';
    tablesResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n📋 Table: ${row.table_name}`);
      }
      console.log(`   - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
    });

    // Check if users table exists and its structure
    const usersTable = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `);

    if (usersTable.rows.length > 0) {
      console.log('\n👤 Users Table Structure:');
      usersTable.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log('\n⚠️  Users table does not exist');
    }

    // Check constraints
    const constraintsResult = await client.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `);

    console.log('\n🔗 Current Constraints:');
    constraintsResult.rows.forEach(row => {
      if (row.constraint_type === 'FOREIGN KEY') {
        console.log(`   - ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
      } else {
        console.log(`   - ${row.table_name}: ${row.constraint_type} (${row.column_name})`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await client.end();
  }
}

checkCurrentSchema().catch(console.error);