# Performance and Load Testing

This document describes the comprehensive performance and load testing implementation for SmartKhabar, specifically designed to validate requirements 8.2 and 8.3.

## Requirements Being Tested

### Requirement 8.2
**System SHALL respond within 3 seconds for summary generation**

This requirement ensures that AI-powered summary generation maintains acceptable response times for user experience.

### Requirement 8.3  
**System SHALL handle at least 100 concurrent users**

This requirement validates that the system can scale to support multiple simultaneous users without degradation.

## Test Structure

### 1. Requirements Validation Tests (`e2e/requirements-validation.spec.ts`)

**Primary focus**: Direct validation of requirements 8.2 and 8.3

**Tests included**:
- `Requirement 8.2: Summary generation responds within 3 seconds`
  - Tests single article, multiple articles, and large article summaries
  - Validates consistent response times across multiple iterations
  - Ensures all summary generation stays under 3-second limit

- `Requirement 8.3: System handles 100 concurrent users`
  - Simulates exactly 100 concurrent users
  - Validates system stability and response times under load
  - Measures success rates and performance degradation

- `Combined requirements validation`
  - Tests 100 users generating summaries simultaneously
  - Validates both requirements working together

- `Performance degradation analysis`
  - Tests increasing load levels (1, 5, 10, 20, 50 concurrent requests)
  - Analyzes how performance degrades with increased load

### 2. Load Testing (`e2e/load-testing.spec.ts`)

**Focus**: Concurrent user handling and API performance

**Key tests**:
- 100 concurrent users simulation (updated for requirement 8.3)
- Summary generation response time validation (requirement 8.2)
- Concurrent API load testing with 3-second validation
- Response time consistency under sustained load
- Database performance under concurrent operations
- Memory usage analysis under load

### 3. Scalability Testing (`e2e/scalability.spec.ts`)

**Focus**: System behavior under increasing load

**Key tests**:
- API endpoint scalability (10, 25, 50, 100 concurrent requests)
- Database connection scalability
- Memory scalability with increasing data sizes
- Concurrent user session scalability up to 100 users
- API response time consistency under varying load
- System recovery after load spikes

### 4. Performance Testing (`e2e/performance.spec.ts`)

**Focus**: Basic performance metrics and optimization

**Key tests**:
- Page load performance (3-second requirement)
- API response time monitoring
- Memory usage tracking
- Core Web Vitals validation
- Network error recovery performance
- Resource loading optimization

## Performance Monitoring Utilities

### PerformanceMonitor Class (`e2e/utils/performance-monitor.ts`)

Provides comprehensive performance monitoring capabilities:

- **Network request tracking**: Monitors API response times and sizes
- **Memory usage monitoring**: Tracks JavaScript heap usage
- **Core Web Vitals**: Measures LCP, FID, CLS, and FCP
- **Response time validation**: Validates against requirement 8.2

### Helper Functions

- `simulateConcurrentUsers()`: Efficiently simulates large numbers of concurrent users
- `analyzeLoadTestResults()`: Analyzes test results against requirements
- `performanceAssertions`: Assertion helpers for requirements validation

## Running Performance Tests

### Individual Test Suites

```bash
# Requirements validation (most important)
npm run test:requirements

# Load testing
npm run test:e2e:load

# Scalability testing  
npm run test:e2e:scalability

# Basic performance testing
npm run test:e2e:performance
```

### Comprehensive Test Suite

```bash
# Run all performance tests with detailed reporting
npm run test:performance:all
```

This script:
- Runs all performance test suites in priority order
- Generates comprehensive performance reports
- Validates both requirements 8.2 and 8.3
- Saves detailed results to `performance-test-report.json`

### Manual Test Execution

```bash
# Run specific test files
npx playwright test e2e/requirements-validation.spec.ts
npx playwright test e2e/load-testing.spec.ts --workers=1
npx playwright test e2e/scalability.spec.ts --reporter=line
```

## Test Configuration

### Playwright Configuration

Tests are configured to run with:
- **Parallel execution**: Enabled for scalability tests
- **Timeouts**: Adjusted for load testing scenarios
- **Retries**: Configured for CI environments
- **Reporters**: Line reporter for detailed output

### Performance Thresholds

| Metric | Requirement | Test Threshold |
|--------|-------------|----------------|
| Summary generation response time | < 3 seconds | < 3000ms |
| Concurrent user success rate | 100 users | ≥ 80% success |
| API response time average | < 3 seconds | < 3000ms |
| Memory usage growth | Reasonable | < 200MB |
| Success rate under load | High | ≥ 85% |

## Interpreting Results

### Success Criteria

**Requirement 8.2 (Summary Generation)**:
- ✅ All summary generation requests complete in < 3 seconds
- ✅ Average response time < 3 seconds across multiple iterations
- ✅ Consistent performance across different content sizes

**Requirement 8.3 (100 Concurrent Users)**:
- ✅ At least 80 out of 100 users successfully complete their sessions
- ✅ System remains responsive under concurrent load
- ✅ No critical failures or timeouts

### Common Issues and Solutions

**High response times**:
- Check database connection pooling
- Verify API rate limiting configuration
- Review LLM service response times

**Low concurrent user success rates**:
- Increase server resources
- Optimize database queries
- Review connection limits

**Memory issues**:
- Check for memory leaks in React components
- Verify proper cleanup of resources
- Review vector store memory usage

## Continuous Integration

Performance tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run Performance Tests
  run: |
    npm run dev &
    sleep 30
    npm run test:performance:all
    kill %1
```

## Monitoring in Production

The performance testing framework provides utilities that can be adapted for production monitoring:

- Response time tracking
- User session analysis
- Performance degradation detection
- Scalability metrics collection

## Best Practices

1. **Run tests in isolated environments** to avoid interference
2. **Use consistent test data** for reproducible results
3. **Monitor system resources** during test execution
4. **Analyze trends over time** rather than single test runs
5. **Test with realistic user patterns** and data volumes

## Troubleshooting

### Test Failures

1. **Check application status**: Ensure the app is running on `http://localhost:3000`
2. **Verify database connectivity**: Run `npm run db:test`
3. **Check resource limits**: Monitor CPU and memory during tests
4. **Review test logs**: Check Playwright test reports for detailed errors

### Performance Issues

1. **Profile slow endpoints**: Use browser dev tools or API monitoring
2. **Check database performance**: Review query execution times
3. **Monitor external services**: Verify LLM and news API response times
4. **Analyze memory usage**: Look for memory leaks or excessive allocation

For additional support, review the test output logs and performance reports generated by the test suite.