#!/usr/bin/env node

/**
 * Vercel Environment Setup Script
 * Helps configure environment variables for Vercel deployment
 */

const fs = require('fs');
const path = require('path');

const ENV_VARS_CONFIG = {
  // Database Configuration
  SUPABASE_URL: {
    description: 'Supabase project URL',
    required: true,
    example: 'https://your-project.supabase.co'
  },
  SUPABASE_ANON_KEY: {
    description: 'Supabase anonymous key',
    required: true,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  
  // API Keys
  NEWS_API_KEY: {
    description: 'NewsAPI.org API key',
    required: true,
    example: 'abc123def456...'
  },
  OPENAI_API_KEY: {
    description: 'OpenAI API key for LLM services',
    required: true,
    example: 'sk-...'
  },
  FIRECRAWL_API_KEY: {
    description: 'Firecrawl API key for web scraping',
    required: true,
    example: 'fc-...'
  },
  
  // Application Configuration
  NEXT_PUBLIC_APP_URL: {
    description: 'Public URL of the application',
    required: true,
    example: 'https://your-app.vercel.app'
  },
  NODE_ENV: {
    description: 'Node environment',
    required: false,
    default: 'production'
  }
};

function generateVercelEnvCommands() {
  console.log('📋 Vercel Environment Variables Setup Commands\n');
  console.log('Run these commands to set up your environment variables in Vercel:\n');
  
  Object.entries(ENV_VARS_CONFIG).forEach(([key, config]) => {
    const isRequired = config.required ? '(Required)' : '(Optional)';
    const defaultValue = config.default ? ` [Default: ${config.default}]` : '';
    
    console.log(`# ${config.description} ${isRequired}${defaultValue}`);
    
    if (config.example) {
      console.log(`# Example: ${config.example}`);
    }
    
    console.log(`vercel env add ${key}`);
    console.log('');
  });
  
  console.log('📝 Alternative: Set all at once using Vercel dashboard');
  console.log('   Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables\n');
}

function validateLocalEnv() {
  console.log('🔍 Validating local environment variables...\n');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local file not found');
    console.log('   This is normal for production deployment, but you may want it for local testing\n');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const localEnvVars = {};
  
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      localEnvVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  const missing = [];
  const present = [];
  
  Object.entries(ENV_VARS_CONFIG).forEach(([key, config]) => {
    if (config.required) {
      if (localEnvVars[key]) {
        present.push(key);
      } else {
        missing.push(key);
      }
    }
  });
  
  if (present.length > 0) {
    console.log('✅ Found local environment variables:');
    present.forEach(key => console.log(`   - ${key}`));
    console.log('');
  }
  
  if (missing.length > 0) {
    console.log('❌ Missing required local environment variables:');
    missing.forEach(key => {
      const config = ENV_VARS_CONFIG[key];
      console.log(`   - ${key}: ${config.description}`);
    });
    console.log('');
  }
  
  if (missing.length === 0) {
    console.log('✅ All required environment variables are present locally\n');
  }
}

function generateEnvExample() {
  console.log('📄 Generating updated .env.example...\n');
  
  let envExample = '# SmartKhabar Environment Variables\n';
  envExample += '# Copy this file to .env.local and fill in your actual values\n\n';
  
  const categories = {
    'Database Configuration': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    'API Keys': ['NEWS_API_KEY', 'OPENAI_API_KEY', 'FIRECRAWL_API_KEY'],
    'Application Configuration': ['NEXT_PUBLIC_APP_URL', 'NODE_ENV']
  };
  
  Object.entries(categories).forEach(([category, vars]) => {
    envExample += `# ${category}\n`;
    vars.forEach(varName => {
      const config = ENV_VARS_CONFIG[varName];
      if (config) {
        envExample += `# ${config.description}\n`;
        if (config.example) {
          envExample += `${varName}=${config.example}\n`;
        } else if (config.default) {
          envExample += `${varName}=${config.default}\n`;
        } else {
          envExample += `${varName}=your_${varName.toLowerCase()}_here\n`;
        }
        envExample += '\n';
      }
    });
  });
  
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  fs.writeFileSync(envExamplePath, envExample);
  
  console.log('✅ Updated .env.example file');
}

function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'commands':
      generateVercelEnvCommands();
      break;
    case 'validate':
      validateLocalEnv();
      break;
    case 'example':
      generateEnvExample();
      break;
    default:
      console.log('🔧 Vercel Environment Setup Helper\n');
      console.log('Usage:');
      console.log('  node scripts/setup-vercel-env.js commands  - Generate Vercel CLI commands');
      console.log('  node scripts/setup-vercel-env.js validate  - Validate local environment');
      console.log('  node scripts/setup-vercel-env.js example   - Update .env.example file');
      console.log('');
      console.log('For complete setup, run all commands:');
      console.log('  npm run env:validate');
      console.log('  npm run env:commands');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ENV_VARS_CONFIG,
  generateVercelEnvCommands,
  validateLocalEnv,
  generateEnvExample
};