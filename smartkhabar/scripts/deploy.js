#!/usr/bin/env node

/**
 * Deployment script for SmartKhabar
 * Handles pre-deployment checks and environment validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local for local testing
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'NEWS_API_KEY',
  'OPENAI_API_KEY',
  'FIRECRAWL_API_KEY',
  'NEXT_PUBLIC_APP_URL'
];

function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...');
  
  const missing = [];
  
  REQUIRED_ENV_VARS.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`  - ${envVar}`));
    console.error('\nPlease set these variables in your Vercel dashboard or .env.local file');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
}

function runTests() {
  console.log('🧪 Running tests...');
  
  try {
    execSync('npm run test:run', { stdio: 'inherit' });
    console.log('✅ All tests passed');
  } catch (error) {
    console.error('❌ Tests failed');
    process.exit(1);
  }
}

function typeCheck() {
  console.log('🔍 Running type check...');
  
  try {
    execSync('npm run type-check', { stdio: 'inherit' });
    console.log('✅ Type check passed');
  } catch (error) {
    console.error('❌ Type check failed');
    process.exit(1);
  }
}

function buildProject() {
  console.log('🏗️  Building project...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build successful');
  } catch (error) {
    console.error('❌ Build failed');
    process.exit(1);
  }
}

function validateVercelConfig() {
  console.log('🔍 Validating Vercel configuration...');
  
  const vercelConfigPath = path.join(__dirname, '..', 'vercel.json');
  
  if (!fs.existsSync(vercelConfigPath)) {
    console.error('❌ vercel.json not found');
    process.exit(1);
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    
    // Check required fields
    if (!config.functions) {
      console.error('❌ No functions configuration found in vercel.json');
      process.exit(1);
    }
    
    if (!config.crons || config.crons.length === 0) {
      console.error('❌ No cron jobs configuration found in vercel.json');
      process.exit(1);
    }
    
    console.log('✅ Vercel configuration is valid');
  } catch (error) {
    console.error('❌ Invalid vercel.json:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🚀 Starting deployment preparation...\n');
  
  const skipTests = process.argv.includes('--skip-tests');
  const skipBuild = process.argv.includes('--skip-build');
  
  try {
    validateVercelConfig();
    checkEnvironmentVariables();
    typeCheck();
    
    if (!skipTests) {
      runTests();
    } else {
      console.log('⚠️  Skipping tests (--skip-tests flag provided)');
    }
    
    if (!skipBuild) {
      buildProject();
    } else {
      console.log('⚠️  Skipping build (--skip-build flag provided)');
    }
    
    console.log('\n✅ Deployment preparation complete!');
    console.log('🚀 You can now deploy to Vercel using: vercel --prod');
    
  } catch (error) {
    console.error('\n❌ Deployment preparation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentVariables,
  runTests,
  typeCheck,
  buildProject,
  validateVercelConfig
};