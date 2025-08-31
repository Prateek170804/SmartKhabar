#!/usr/bin/env node

/**
 * Production Environment Setup Script for SmartKhabar
 * Validates and sets up environment variables for Vercel deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Required environment variables for production
const REQUIRED_ENV_VARS = {
  'DATABASE_URL': 'PostgreSQL connection string (Neon database)',
  'GNEWS_API_KEY': 'GNews API key for news collection',
  'HUGGINGFACE_API_KEY': 'Hugging Face API token for AI processing',
  'NEXT_PUBLIC_APP_URL': 'Public URL of your deployed application'
};

// Optional environment variables
const OPTIONAL_ENV_VARS = {
  'SUPABASE_URL': 'Supabase project URL (if using Supabase)',
  'SUPABASE_ANON_KEY': 'Supabase anonymous key',
  'NEWS_API_KEY': 'NewsAPI.org key (backup news source)',
  'OPENAI_API_KEY': 'OpenAI API key (backup AI service)',
  'FIRECRAWL_API_KEY': 'Firecrawl API key (backup scraping)',
  'SCRAPINGBEE_API_KEY': 'ScrapingBee API key (backup scraping)'
};

function loadProductionEnv() {
  const prodEnvPath = path.join(__dirname, '..', '.env.production');
  
  if (!fs.existsSync(prodEnvPath)) {
    console.error('❌ .env.production file not found');
    return {};
  }
  
  const envContent = fs.readFileSync(prodEnvPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value && !value.includes('your_') && !value.includes('_here')) {
        envVars[key.trim()] = value;
      }
    }
  });
  
  return envVars;
}

function validateEnvironmentVariables() {
  console.log('🔍 Validating production environment variables...\n');
  
  const prodEnvVars = loadProductionEnv();
  const missing = [];
  const invalid = [];
  
  // Check required variables
  Object.entries(REQUIRED_ENV_VARS).forEach(([key, description]) => {
    if (!prodEnvVars[key]) {
      missing.push({ key, description });
    } else if (prodEnvVars[key].includes('your_') || prodEnvVars[key].includes('_here')) {
      invalid.push({ key, description, value: prodEnvVars[key] });
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(({ key, description }) => {
      console.error(`  - ${key}: ${description}`);
    });
    console.error('');
  }
  
  if (invalid.length > 0) {
    console.error('❌ Invalid environment variables (placeholder values):');
    invalid.forEach(({ key, description, value }) => {
      console.error(`  - ${key}: ${value}`);
      console.error(`    Expected: ${description}`);
    });
    console.error('');
  }
  
  if (missing.length > 0 || invalid.length > 0) {
    console.error('Please update your .env.production file with valid values');
    return false;
  }
  
  console.log('✅ All required environment variables are valid\n');
  return true;
}

function generateVercelEnvCommands() {
  console.log('📋 Vercel Environment Variable Setup Commands:\n');
  
  const prodEnvVars = loadProductionEnv();
  
  console.log('Copy and run these commands to set up your Vercel environment variables:\n');
  
  Object.entries(REQUIRED_ENV_VARS).forEach(([key, description]) => {
    const value = prodEnvVars[key] || 'YOUR_VALUE_HERE';
    console.log(`vercel env add ${key} production`);
    console.log(`# ${description}`);
    console.log(`# Value: ${value}`);
    console.log('');
  });
  
  console.log('Optional environment variables:');
  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, description]) => {
    if (prodEnvVars[key]) {
      console.log(`vercel env add ${key} production`);
      console.log(`# ${description}`);
      console.log(`# Value: ${prodEnvVars[key]}`);
      console.log('');
    }
  });
}

function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    console.log('✅ Vercel CLI is installed');
    return true;
  } catch (error) {
    console.log('❌ Vercel CLI is not installed');
    console.log('Install it with: npm install -g vercel');
    return false;
  }
}

function checkVercelAuth() {
  try {
    execSync('vercel whoami', { stdio: 'pipe' });
    console.log('✅ Vercel CLI is authenticated');
    return true;
  } catch (error) {
    console.log('❌ Vercel CLI is not authenticated');
    console.log('Run: vercel login');
    return false;
  }
}

function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'validate':
      if (validateEnvironmentVariables()) {
        console.log('🎉 Production environment is ready for deployment!');
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;
      
    case 'commands':
      generateVercelEnvCommands();
      break;
      
    case 'check':
      console.log('🔍 Checking deployment readiness...\n');
      
      const envValid = validateEnvironmentVariables();
      const vercelInstalled = checkVercelCLI();
      const vercelAuth = checkVercelAuth();
      
      if (envValid && vercelInstalled && vercelAuth) {
        console.log('🎉 Everything is ready for deployment!');
        console.log('Run: npm run vercel:deploy');
      } else {
        console.log('❌ Please fix the issues above before deploying');
        process.exit(1);
      }
      break;
      
    default:
      console.log('SmartKhabar Production Environment Setup\n');
      console.log('Usage:');
      console.log('  node scripts/setup-production-env.js validate   - Validate environment variables');
      console.log('  node scripts/setup-production-env.js commands   - Generate Vercel env commands');
      console.log('  node scripts/setup-production-env.js check      - Check deployment readiness');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironmentVariables,
  generateVercelEnvCommands,
  loadProductionEnv
};