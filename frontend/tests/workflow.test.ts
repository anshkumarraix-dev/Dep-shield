import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateAndParsePackageLock,
  parseLockfileContent,
  SAMPLE_DEMO_PACKAGE_LOCK,
} from '@/services/lockfileParser';

import {
  mockFindings,
  mockSummaryMetrics,
  mockActivity,
} from '@/mocks/mockData';

import { scansService } from '@/services/scansService';

test('Criterion 1: Valid lockfile v2 parsing', () => {
  const v2Lockfile = JSON.stringify({
    name: 'test-v2-app',
    version: '1.0.0',
    lockfileVersion: 2,
    requires: true,
    packages: {
      '': {
        name: 'test-v2-app',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.2',
        },
      },
      'node_modules/express': {
        version: '4.18.2',
        resolved: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
        dependencies: {
          cookie: '0.5.0',
        },
      },
      'node_modules/cookie': {
        version: '0.5.0',
        resolved: 'https://registry.npmjs.org/cookie/-/cookie-0.5.0.tgz',
      },
    },
  });

  const res = validateAndParsePackageLock(v2Lockfile, 'v2-package-lock.json');
  assert.equal(res.valid, true, 'Lockfile v2 should be valid');
  assert.ok(res.summary, 'Summary should be produced');
  assert.equal(res.summary.lockfileVersion, 2);
  assert.equal(res.summary.totalPackagesDetected, 2);
  assert.equal(res.summary.directDependenciesCount, 1);
  assert.equal(res.summary.transitiveDependenciesCount, 1);
});

test('Criterion 2: Valid lockfile v3 parsing', () => {
  const res = validateAndParsePackageLock(SAMPLE_DEMO_PACKAGE_LOCK, 'sample-v3.json');
  assert.equal(res.valid, true);
  assert.ok(res.summary);
  assert.equal(res.summary.lockfileVersion, 3);
  assert.equal(res.summary.projectName, 'depshield-demo-app');
  assert.equal(res.summary.totalPackagesDetected, 11);
  assert.equal(res.summary.directDependenciesCount, 7);
  assert.equal(res.summary.transitiveDependenciesCount, 4);
  assert.equal(res.summary.analyzedPackages.length, 4, 'Prioritizes <= 4 deep analysis packages');
});

test('Criterion 3: Invalid JSON and unsupported versions rejection', () => {
  // Empty content
  const emptyRes = validateAndParsePackageLock('');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.error || '', /empty/i);

  // Invalid JSON
  const invalidJsonRes = validateAndParsePackageLock('{ invalid json content');
  assert.equal(invalidJsonRes.valid, false);
  assert.match(invalidJsonRes.error || '', /Invalid JSON syntax/i);

  // Missing lockfileVersion
  const missingVer = validateAndParsePackageLock(JSON.stringify({ name: 'foo' }));
  assert.equal(missingVer.valid, false);
  assert.match(missingVer.error || '', /lockfileVersion/i);

  // Unsupported legacy v1
  const v1Lock = JSON.stringify({ name: 'foo', lockfileVersion: 1, dependencies: {} });
  const v1Res = validateAndParsePackageLock(v1Lock);
  assert.equal(v1Res.valid, false);
  assert.match(v1Res.error || '', /v1 \(legacy format\)/i);

  // Unsupported future v4
  const v4Lock = JSON.stringify({ name: 'foo', lockfileVersion: 4, packages: {} });
  const v4Res = validateAndParsePackageLock(v4Lock);
  assert.equal(v4Res.valid, false);
  assert.match(v4Res.error || '', /Unsupported lockfileVersion/i);
});

test('Criterion 4: Direct/transitive counts and identity deduplication', () => {
  // Duplicate identical coordinate in different nested paths
  const dupeLock = JSON.stringify({
    name: 'dupe-app',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        dependencies: {
          shared: '^1.0.0',
        },
      },
      'node_modules/shared': {
        version: '1.0.0',
      },
      'node_modules/other/node_modules/shared': {
        version: '1.0.0',
      },
    },
  });

  const res = validateAndParsePackageLock(dupeLock);
  assert.equal(res.valid, true);
  assert.ok(res.summary);
  assert.equal(res.summary.totalPackagesDetected, 1, 'Duplicate coordinate shared@1.0.0 should be deduplicated to 1');
  assert.equal(res.summary.directDependenciesCount, 1);
  assert.equal(res.summary.transitiveDependenciesCount, 0);
});

test('Criterion 5: Selecting and replacing a file', () => {
  const file1 = JSON.stringify({
    name: 'app-one',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { axios: '^1.0.0' } },
      'node_modules/axios': { version: '1.0.0' },
    },
  });

  const file2 = JSON.stringify({
    name: 'app-two',
    lockfileVersion: 2,
    packages: {
      '': { dependencies: { lodash: '^4.0.0', debug: '^2.0.0' } },
      'node_modules/lodash': { version: '4.0.0' },
      'node_modules/debug': { version: '2.0.0' },
    },
  });

  const res1 = validateAndParsePackageLock(file1, 'first.json');
  assert.ok(res1.summary);
  assert.equal(res1.summary.projectName, 'app-one');
  assert.equal(res1.summary.totalPackagesDetected, 1);

  const res2 = validateAndParsePackageLock(file2, 'second.json');
  assert.ok(res2.summary);
  assert.equal(res2.summary.projectName, 'app-two');
  assert.equal(res2.summary.totalPackagesDetected, 2);
  assert.equal(res2.summary.fileName, 'second.json');
});

test('Criterion 6 & 7: Starting and restarting demo scan with progress completion', async () => {
  const summary = parseLockfileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'demo.json');
  const progressEvents: string[] = [];

  const result1 = await scansService.simulateScan(summary, (progress) => {
    progressEvents.push(progress.stage);
  });

  // Verify all 6 workflow stages occurred in order
  assert.deepEqual(progressEvents, [
    'parsing',
    'baseline',
    'signals',
    'evidence',
    'scoring',
    'findings',
    'completed',
  ]);

  assert.equal(result1.summary.totalDependenciesScanned, 11);
  assert.equal(result1.summary.analyzedCount, 4);
  assert.ok(result1.findings.length > 0);
  assert.ok(result1.activity.length > 0);

  // Restart scan a second time to ensure idempotency and no memory leak
  const progressEvents2: string[] = [];
  const result2 = await scansService.simulateScan(summary, (progress) => {
    progressEvents2.push(progress.stage);
  });

  assert.equal(result2.findings.length, result1.findings.length);
  assert.equal(progressEvents2.length, 7);
});

test('Criterion 8: Stable demo fixture consistency', () => {
  assert.equal(mockFindings.length, 6, 'Mock catalog must contain exactly 6 curated findings');
  assert.equal(mockSummaryMetrics.criticalCount, 1);
  assert.equal(mockSummaryMetrics.highCount, 2);
  assert.equal(mockSummaryMetrics.watchCount, 2);
  assert.equal(mockSummaryMetrics.infoCount, 1);

  // Every finding must have non-empty required properties
  mockFindings.forEach((f) => {
    assert.ok(f.id, 'Finding must have an ID');
    assert.ok(f.packageName, 'Finding must have a packageName');
    assert.ok(f.installedVersion, 'Finding must have an installedVersion');
    assert.ok(f.riskExplanation, 'Finding must have a risk explanation');
    assert.ok(['CRITICAL', 'HIGH', 'WATCH', 'INFO'].includes(f.riskLevel));
    assert.ok(f.deterministicRuleApplied, 'Must document deterministic scoring rule');
    assert.ok(f.sources.length >= 1, 'Must have at least 1 source');
    assert.ok(f.evidenceQuotes.length >= 1, 'Must have at least 1 evidence quote');
  });
});

test('Criterion 9: Risk and dependency filters', async () => {
  const allFindings = await scansService.getFindings();
  assert.equal(allFindings.length, 6);

  const criticalOnly = await scansService.getFindings({ riskLevel: 'CRITICAL' });
  assert.equal(criticalOnly.length, 1);
  assert.ok(criticalOnly.every((f) => f.riskLevel === 'CRITICAL'));

  const directOnly = await scansService.getFindings({ dependencyType: 'direct' });
  assert.ok(directOnly.every((f) => f.dependencyType === 'direct'));

  const searchResults = await scansService.getFindings({ searchQuery: 'lodash' });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].packageName, 'lodash');
});

test('Criterion 10: Finding details matching the selected row', async () => {
  const findings = await scansService.getFindings();
  for (const finding of findings) {
    const fetched = await scansService.getFindingById(finding.id);
    assert.ok(fetched, `Finding ${finding.id} must be retrievable`);
    assert.equal(fetched?.title, finding.title);
    assert.equal(fetched?.packageName, finding.packageName);
    assert.equal(fetched?.installedVersion, finding.installedVersion);
    assert.equal(fetched?.riskLevel, finding.riskLevel);
    assert.equal(fetched?.riskExplanation, finding.riskExplanation);
  }
});

test('Criterion 11: Correct synthetic-data labels', () => {
  assert.equal(mockSummaryMetrics.isSyntheticDemo, true, 'Metrics must indicate synthetic demo');

  mockFindings.forEach((f) => {
    assert.equal(f.isSyntheticDemo, true, 'Finding must indicate synthetic demo');
    f.evidenceQuotes.forEach((q) => {
      assert.equal(q.isSynthetic, true, 'Quote must indicate synthetic telemetry');
      assert.notEqual(q.verificationStatus, 'live_verified', 'Must never claim live verified');
    });
  });

  mockActivity.forEach((a) => {
    assert.equal(a.isSimulated, true, 'Activity event must indicate simulated pipeline');
  });
});

test('Criterion 12: Zero network or paid API calls from mock/demo workflow', async () => {
  // Spy on global fetch to ensure it is never called during simulateScan
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalled = true;
    return Promise.reject(new Error('Network access is strictly forbidden in mock demo mode'));
  };

  try {
    const summary = parseLockfileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'demo.json');
    await scansService.simulateScan(summary);
    await scansService.getSummaryMetrics();
    await scansService.getFindings();
    await scansService.getActivityFeed();

    assert.equal(fetchCalled, false, 'SimulateScan and mock getters must NEVER make HTTP requests');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
