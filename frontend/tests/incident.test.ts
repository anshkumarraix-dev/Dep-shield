import test from 'node:test';
import assert from 'node:assert/strict';

import { REPLAY_CASES } from '@/data/replay';
import { evaluateDeterministicRules } from '@/utils/rulesEngine';
import { computeLeadTime } from '@/utils/timeUtils';
import { scansService } from '@/services/scansService';
import { parseLockfileContent, SAMPLE_DEMO_PACKAGE_LOCK } from '@/services/lockfileParser';

test('Acceptance 1: Fixture events are in non-decreasing time order', () => {
  for (const rCase of REPLAY_CASES) {
    for (let i = 1; i < rCase.timeline.length; i++) {
      const prev = rCase.timeline[i - 1];
      const curr = rCase.timeline[i];
      assert.ok(
        curr.timeSeconds >= prev.timeSeconds,
        `Case ${rCase.id}: event ${curr.id} (${curr.timestamp}, ${curr.timeSeconds}s) must be >= previous ${prev.id} (${prev.timestamp}, ${prev.timeSeconds}s)`
      );
    }
  }
});

test('Acceptance 2: Every stored evidence_quote is a literal substring of its excerpt', () => {
  for (const rCase of REPLAY_CASES) {
    for (const ev of rCase.timeline) {
      assert.ok(ev.quote && ev.quote.trim().length > 0, `Event ${ev.id} in ${rCase.id} must have a quote`);
      assert.ok(ev.excerpt && ev.excerpt.trim().length > 0, `Event ${ev.id} in ${rCase.id} must have an excerpt`);
      assert.ok(
        ev.excerpt.includes(ev.quote),
        `Event ${ev.id} in ${rCase.id}: quote "${ev.quote}" MUST be a literal substring of excerpt "${ev.excerpt}"`
      );
    }
  }
});

test('Acceptance 3: What-if function rules enforcement', () => {
  // Rule A: 1 source gives at most WATCH (never HIGH or CRITICAL)
  const singleSourceCritical = evaluateDeterministicRules({
    independentSourceCount: 1,
    exactVersionMatched: true,
    severity: 'CRITICAL',
    hasInstallScript: true,
  });
  assert.equal(
    singleSourceCritical.riskLevel,
    'WATCH',
    'Single source must be capped at WATCH even if payload is critical'
  );

  const singleSourceHigh = evaluateDeterministicRules({
    independentSourceCount: 1,
    exactVersionMatched: true,
    severity: 'HIGH',
  });
  assert.equal(singleSourceHigh.riskLevel, 'WATCH', 'Single source must be capped at WATCH');

  // Rule B: 2 independent + exact version + critical gives CRITICAL
  const multiSourceCritical = evaluateDeterministicRules({
    independentSourceCount: 2,
    exactVersionMatched: true,
    severity: 'CRITICAL',
    hasInstallScript: true,
  });
  assert.equal(
    multiSourceCritical.riskLevel,
    'CRITICAL',
    '2 independent + exact version + critical must yield CRITICAL'
  );

  // Rule C: Unknown never yields "safe"
  const unknownEvaluation = evaluateDeterministicRules({
    independentSourceCount: 0,
    exactVersionMatched: false,
    severity: 'UNKNOWN',
    osvMatched: null, // inconclusive/unknown lookup
  });
  assert.equal(unknownEvaluation.isSafe, false, 'Unknown lookup state must never be declared safe');
  assert.notEqual(unknownEvaluation.riskLevel, 'INFO', 'Inconclusive lookup must not be classified as safe info');
  assert.equal(unknownEvaluation.riskLevel, 'UNKNOWN');
  assert.match(unknownEvaluation.statusExplanation, /not verified as safe/i);

  const unverifiedBaseline = evaluateDeterministicRules({
    independentSourceCount: 0,
    exactVersionMatched: true,
    severity: 'LOW',
    osvMatched: null, // unperformed OSV lookup
  });
  assert.equal(unverifiedBaseline.isSafe, false, 'Unverified baseline must never declare isSafe: true');
});

test('Acceptance 4: Lead-time function returns 32m23s and 26m42s', () => {
  // 09:02:37 to 09:35:00 -> 32m23s
  const lead1 = computeLeadTime('09:02:37', '09:35:00');
  assert.equal(lead1.formatted, '32m23s', 'Expected 32m23s for 09:02:37 to 09:35:00');
  assert.equal(lead1.totalSeconds, 1943);

  // 09:08:18 to 09:35:00 -> 26m42s
  const lead2 = computeLeadTime('09:08:18', '09:35:00');
  assert.equal(lead2.formatted, '26m42s', 'Expected 26m42s for 09:08:18 to 09:35:00');
  assert.equal(lead2.totalSeconds, 1602);
});

test('Acceptance 5: Mock mode performs zero fetch network calls', async () => {
  let fetchAttempted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchAttempted = true;
    return Promise.reject(new Error('Network calls are forbidden in MOCK / REPLAY modes'));
  };

  try {
    const summary = parseLockfileContent(SAMPLE_DEMO_PACKAGE_LOCK, 'test.json');
    await scansService.simulateScan(summary);
    await scansService.getSummaryMetrics();
    await scansService.getFindings();
    await scansService.getActivityFeed();

    assert.equal(fetchAttempted, false, 'Zero network calls permitted in mock/replay mode');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
