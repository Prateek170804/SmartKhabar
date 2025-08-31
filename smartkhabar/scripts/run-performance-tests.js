#!/usr/bin/env node

/**
 * Comprehensive Performance and Load Testing Script
 * 
 * This script runs all performance and load tests to validate:
 * - Requirement 8.2: System SHALL respond within 3 seconds for summary generation
 * - Requirement 8.3: System SHALL handle at least 100 concurrent users
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Comprehensive Performance and Load Testing');
console.log('=' .repeat(60));

// Test configuration
const testConfig = {
  requirements: {
    file: 'e2e/requirements-validation.spec.ts',
    description: 'Validate specific requirements 8.2 and 8.3',
    priority: 1
  },
  performance: {
    file: 'e2e/performance.spec.ts',
    description: 'Basic performance metrics and Core Web Vitals',
    priority: 2
  },
  loadTesting: {
    file: 'e2e/load-testing.spec.ts', 
    description: 'Concurrent user handling and API load testing',
    priority: 3
  },
  scalability: {
    file: 'e2e/scalability.spec.ts',
    description: 'System scalability under increasing load',
    priority: 4
  }
};

// Results tracking
const results = {
  passed: [],
  failed: [],
  startTime: Date.now()
};

/**
 * Run a specific test suite
 */
async function runTestSuite(testName, config) {
  console.log(`\n📊 Running ${testName} tests...`);
  console.log(`Description: ${config.description}`);
  console.log('-'.repeat(50));
  
  try {
    const startTime = Date.now();
    
    // Run the test with detailed output
    const command = `npx playwright test ${config.file} --reporter=line`;
    console.log(`Executing: ${command}`);
    
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${testName} tests PASSED (${duration}ms)`);
    console.log(output);
    
    results.passed.push({
      name: testName,
      duration,
      output: output.substring(0, 500) // Truncate for summary
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ ${testName} tests FAILED (${duration}ms)`);
    console.log('Error output:');
    console.log(error.stdout || error.message);
    
    results.failed.push({
      name: testName,
      duration,
      error: error.stdout || error.message
    });
  }
}

/**
 * Generate performance test report
 */
function generateReport() {
  const totalDuration = Date.now() - results.startTime;
  const totalTests = results.passed.length + results.failed.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 PERFORMANCE TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n⏱️  Total Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(1)}s)`);
  console.log(`📊 Total Test Suites: ${totalTests}`);
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📈 Success Rate: ${((results.passed.length / totalTests) * 100).toFixed(1)}%`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ PASSED TEST SUITES:');
    results.passed.forEach(test => {
      console.log(`  • ${test.name} (${test.duration}ms)`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TEST SUITES:');
    results.failed.forEach(test => {
      console.log(`  • ${test.name} (${test.duration}ms)`);
      console.log(`    Error: ${test.error.substring(0, 200)}...`);
    });
  }
  
  console.log('\n📋 REQUIREMENTS VALIDATION:');
  console.log('  • Requirement 8.2: Response within 3 seconds for summary generation');
  console.log('  • Requirement 8.3: Handle at least 100 concurrent users');
  
  if (results.failed.length === 0) {
    console.log('\n🎉 ALL PERFORMANCE TESTS PASSED!');
    console.log('System meets performance and scalability requirements.');
  } else {
    console.log('\n⚠️  SOME PERFORMANCE TESTS FAILED');
    console.log('Review failed tests and optimize system performance.');
  }
  
  // Save detailed report
  const reportPath = path.join(process.cwd(), 'performance-test-report.json');
  const detailedReport = {
    timestamp: new Date().toISOString(),
    totalDuration,
    results,
    requirements: {
      '8.2': 'System SHALL respond within 3 seconds for summary generation',
      '8.3': 'System SHALL handle at least 100 concurrent users'
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if the application is running
    console.log('🔍 Checking if application is running...');
    try {
      execSync('curl -f http://localhost:3000/api/health', { stdio: 'pipe' });
      console.log('✅ Application is running on http://localhost:3000');
    } catch (error) {
      console.log('❌ Application is not running. Please start it with: npm run dev');
      process.exit(1);
    }
    
    // Run all test suites in priority order
    const sortedTests = Object.entries(testConfig).sort(([,a], [,b]) => (a.priority || 999) - (b.priority || 999));
    
    for (const [testName, config] of sortedTests) {
      await runTestSuite(testName, config);
    }
    
    // Generate final report
    generateReport();
    
    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('💥 Fatal error running performance tests:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Performance tests interrupted');
  generateReport();
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Performance tests terminated');
  generateReport();
  process.exit(1);
});

// Run the tests
main();