#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Comprehensive E2E Test Runner for SmartKhabar
 * Runs all user workflow tests including personalization, cross-browser, and accessibility
 */

const TEST_SUITES = {
  workflows: 'e2e/user-workflows.spec.ts',
  personalization: 'e2e/personalization-workflows.spec.ts',
  crossBrowser: 'e2e/cross-browser.spec.ts',
  accessibility: 'e2e/accessibility.spec.ts',
  performance: 'e2e/performance.spec.ts',
  visual: 'e2e/visual-regression.spec.ts'
};

const BROWSERS = ['chromium', 'firefox', 'webkit'];
const MOBILE_PROJECTS = ['Mobile Chrome', 'Mobile Safari'];

class E2ETestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: {}
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        ...options
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    // Create test environment file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      const testEnv = `
SUPABASE_URL=https://test.supabase.co
SUPABASE_ANON_KEY=test-anon-key
NEWS_API_KEY=test-news-api-key
OPENAI_API_KEY=test-openai-key
FIRECRAWL_API_KEY=test-firecrawl-key
GNEWS_API_KEY=test-gnews-key
NEON_DATABASE_URL=postgresql://test:test@localhost:5432/test
NODE_ENV=test
      `.trim();
      
      fs.writeFileSync(envPath, testEnv);
      console.log('✅ Created test environment file');
    }

    // Install Playwright browsers
    try {
      await this.runCommand('npx', ['playwright', 'install', '--with-deps']);
      console.log('✅ Playwright browsers installed');
    } catch (error) {
      console.error('❌ Failed to install Playwright browsers:', error.message);
      throw error;
    }
  }

  async runTestSuite(suiteName, testFile, options = {}) {
    console.log(`\n📋 Running ${suiteName} tests...`);
    
    const args = ['playwright', 'test', testFile];
    
    if (options.browser) {
      args.push(`--project=${options.browser}`);
    }
    
    if (options.headed) {
      args.push('--headed');
    }
    
    if (options.debug) {
      args.push('--debug');
    }

    try {
      await this.runCommand('npx', args);
      this.results.suites[suiteName] = 'PASSED';
      this.results.passed++;
      console.log(`✅ ${suiteName} tests passed`);
    } catch (error) {
      this.results.suites[suiteName] = 'FAILED';
      this.results.failed++;
      console.error(`❌ ${suiteName} tests failed:`, error.message);
      
      if (!options.continueOnFailure) {
        throw error;
      }
    }
  }

  async runCrossBrowserTests() {
    console.log('\n🌐 Running cross-browser compatibility tests...');
    
    for (const browser of BROWSERS) {
      try {
        await this.runTestSuite(
          `Cross-browser (${browser})`,
          TEST_SUITES.crossBrowser,
          { browser, continueOnFailure: true }
        );
      } catch (error) {
        console.error(`❌ Cross-browser tests failed for ${browser}`);
      }
    }
  }

  async runMobileTests() {
    console.log('\n📱 Running mobile device tests...');
    
    for (const project of MOBILE_PROJECTS) {
      try {
        await this.runTestSuite(
          `Mobile (${project})`,
          TEST_SUITES.workflows,
          { browser: project, continueOnFailure: true }
        );
      } catch (error) {
        console.error(`❌ Mobile tests failed for ${project}`);
      }
    }
  }

  async runAllWorkflowTests(options = {}) {
    console.log('\n🔄 Running all user workflow tests...');
    
    const testOrder = [
      'workflows',
      'personalization',
      'accessibility',
      'performance'
    ];

    for (const suiteName of testOrder) {
      if (TEST_SUITES[suiteName]) {
        await this.runTestSuite(suiteName, TEST_SUITES[suiteName], {
          continueOnFailure: options.continueOnFailure || false
        });
      }
    }

    // Run visual regression tests separately (they can be flaky)
    if (options.includeVisual) {
      await this.runTestSuite('visual', TEST_SUITES.visual, {
        continueOnFailure: true
      });
    }
  }

  async generateReport() {
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);
    
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Duration: ${duration}s`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    
    console.log('\nSuite Results:');
    Object.entries(this.results.suites).forEach(([suite, status]) => {
      const icon = status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${icon} ${suite}: ${status}`);
    });

    // Generate HTML report
    try {
      await this.runCommand('npx', ['playwright', 'show-report', '--host', '0.0.0.0']);
    } catch (error) {
      console.log('📄 HTML report available at: playwright-report/index.html');
    }
  }

  async run() {
    const args = process.argv.slice(2);
    const options = {
      continueOnFailure: args.includes('--continue-on-failure'),
      includeVisual: args.includes('--include-visual'),
      crossBrowser: args.includes('--cross-browser'),
      mobile: args.includes('--mobile'),
      headed: args.includes('--headed'),
      debug: args.includes('--debug')
    };

    try {
      await this.setupTestEnvironment();

      if (args.includes('--help')) {
        this.showHelp();
        return;
      }

      // Run specific test suite if specified
      const suiteArg = args.find(arg => arg.startsWith('--suite='));
      if (suiteArg) {
        const suiteName = suiteArg.split('=')[1];
        if (TEST_SUITES[suiteName]) {
          await this.runTestSuite(suiteName, TEST_SUITES[suiteName], options);
        } else {
          console.error(`❌ Unknown test suite: ${suiteName}`);
          console.log('Available suites:', Object.keys(TEST_SUITES).join(', '));
          process.exit(1);
        }
      } else {
        // Run all tests
        await this.runAllWorkflowTests(options);

        if (options.crossBrowser) {
          await this.runCrossBrowserTests();
        }

        if (options.mobile) {
          await this.runMobileTests();
        }
      }

      await this.generateReport();

      if (this.results.failed > 0) {
        console.log('\n❌ Some tests failed. Check the report for details.');
        process.exit(1);
      } else {
        console.log('\n✅ All tests passed!');
      }

    } catch (error) {
      console.error('\n💥 Test runner failed:', error.message);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
SmartKhabar E2E Test Runner

Usage: node scripts/run-e2e-tests.js [options]

Options:
  --suite=<name>           Run specific test suite (workflows, personalization, crossBrowser, accessibility, performance, visual)
  --cross-browser          Run cross-browser compatibility tests
  --mobile                 Run mobile device tests
  --include-visual         Include visual regression tests
  --continue-on-failure    Continue running tests even if some fail
  --headed                 Run tests in headed mode (visible browser)
  --debug                  Run tests in debug mode
  --help                   Show this help message

Examples:
  node scripts/run-e2e-tests.js                                    # Run all workflow tests
  node scripts/run-e2e-tests.js --cross-browser --mobile          # Run all tests including cross-browser and mobile
  node scripts/run-e2e-tests.js --suite=personalization           # Run only personalization tests
  node scripts/run-e2e-tests.js --headed --debug                  # Run tests in debug mode
    `);
  }
}

// Run the test runner
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = E2ETestRunner;
