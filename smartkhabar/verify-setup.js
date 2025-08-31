// Simple verification script to check if the setup is working

console.log('🔍 Verifying SmartKhabar setup...\n');

// Check if all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  '.env.example',
  'src/types/index.ts',
  'src/lib/config.ts',
  'src/lib/supabase.ts',
  'src/utils/index.ts',
  'src/app/api/health/route.ts',
];

const requiredDirs = [
  'src/app/api/news',
  'src/app/api/preferences', 
  'src/app/api/articles',
  'src/app/api/interactions',
  'src/components',
  'src/services',
  'src/data',
];

console.log('📁 Checking required files...');
let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n📂 Checking required directories...');
let allDirsExist = true;
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - MISSING`);
    allDirsExist = false;
  }
});

console.log('\n📦 Checking package.json dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  'langchain',
  '@langchain/community',
  '@langchain/openai',
  '@supabase/supabase-js',
  'faiss-node',
  'axios',
  'newsapi',
  'zod',
  'node-cron',
  'next',
  'react',
  'typescript'
];

let allDepsInstalled = true;
requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep} - NOT INSTALLED`);
    allDepsInstalled = false;
  }
});

console.log('\n🔧 Setup Summary:');
console.log(`Files: ${allFilesExist ? '✅ All present' : '❌ Some missing'}`);
console.log(`Directories: ${allDirsExist ? '✅ All present' : '❌ Some missing'}`);
console.log(`Dependencies: ${allDepsInstalled ? '✅ All installed' : '❌ Some missing'}`);

if (allFilesExist && allDirsExist && allDepsInstalled) {
  console.log('\n🎉 SmartKhabar setup is complete!');
  console.log('\nNext steps:');
  console.log('1. Configure your API keys in .env.local');
  console.log('2. Run "npm run dev" to start the development server');
  console.log('3. Visit http://localhost:3000/api/health to test the API');
} else {
  console.log('\n⚠️  Setup incomplete. Please check the missing items above.');
}