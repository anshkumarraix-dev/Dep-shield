/**
 * Pure TypeScript Deterministic Rules Engine for DepShield
 * Evaluates forensic investigation gates and powers the What-If simulation lab.
 * Mirrors the backend conservative deterministic scoring rules.
 */

export interface WhatIfInput {
  independentSourceCount: number;
  exactVersionMatched: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  hasInstallScript?: boolean;
  osvMatched?: boolean | null; // true = matched, false = clean, null/undefined = unverified
}

export interface GateResult {
  gateId: string;
  name: string;
  passed: boolean;
  status: 'passed' | 'failed' | 'warning' | 'unknown';
  details: string;
}

export interface WhatIfEvaluation {
  riskLevel: 'CRITICAL' | 'HIGH' | 'WATCH' | 'INFO' | 'UNKNOWN';
  statusExplanation: string;
  ruleFired: string;
  isSafe: boolean; // Guaranteed false if unknown or any risk exists; unknown NEVER yields safe!
  gates: GateResult[];
}

/**
 * Pure deterministic rule evaluation.
 * - >= 2 independent original sources + exact version match + critical severity -> CRITICAL
 * - >= 2 independent original sources + exact version match + high severity -> HIGH
 * - 1 independent source -> capped at WATCH at most
 * - Multiple sources but unconfirmed version -> capped at WATCH
 * - 0 sources + unverified OSV -> INFO (with explicit "not verified safe" disclaimer, never 'safe')
 * - Inconclusive / unknown lookup -> UNKNOWN (never 'safe')
 */
export function evaluateDeterministicRules(input: WhatIfInput): WhatIfEvaluation {
  const {
    independentSourceCount,
    exactVersionMatched,
    severity,
    hasInstallScript = false,
    osvMatched = null,
  } = input;

  const gates: GateResult[] = [];

  // Gate 1: Baseline Registry & OSV Check
  const osvState =
    osvMatched === true
      ? 'passed'
      : osvMatched === false
      ? 'failed'
      : 'unknown';
  gates.push({
    gateId: 'gate-baseline',
    name: 'Vulnerability Baseline (OSV / Advisory)',
    passed: osvMatched === true,
    status: osvState,
    details:
      osvMatched === true
        ? 'Target package matched in OSV vulnerability baseline.'
        : osvMatched === false
        ? 'Queried OSV database: zero known advisories recorded.'
        : 'Baseline not verified (query unperformed or unconfirmed).',
  });

  // Gate 2: Multi-Source Corroboration (>= 2 independent origins)
  const multiSourcePassed = independentSourceCount >= 2;
  gates.push({
    gateId: 'gate-independence',
    name: 'Multi-Source Independence (≥2 origins)',
    passed: multiSourcePassed,
    status: multiSourcePassed
      ? 'passed'
      : independentSourceCount === 1
      ? 'warning'
      : 'failed',
    details:
      independentSourceCount >= 2
        ? `Passed: ${independentSourceCount} verified independent public sources found.`
        : independentSourceCount === 1
        ? 'Warning: Single source only. Capped at WATCH to prevent uncorroborated alerts.'
        : 'Zero early public signals detected.',
  });

  // Gate 3: Exact Package & Version Match
  gates.push({
    gateId: 'gate-version',
    name: 'Exact Version Confirmation',
    passed: exactVersionMatched,
    status: exactVersionMatched ? 'passed' : 'warning',
    details: exactVersionMatched
      ? 'Passed: Evidence quotes and manifests reference installed version exactly.'
      : 'Version unconfirmed: Evidence discusses general package or different versions.',
  });

  // Gate 4: Execution Capability / Severity
  const isHighOrCrit = severity === 'CRITICAL' || severity === 'HIGH';
  gates.push({
    gateId: 'gate-capability',
    name: 'Malicious Capability & Severity',
    passed: isHighOrCrit || hasInstallScript,
    status: severity === 'CRITICAL' ? 'passed' : severity === 'HIGH' ? 'passed' : 'warning',
    details:
      severity === 'CRITICAL'
        ? `Critical execution risk identified${hasInstallScript ? ' (with install-time hooks)' : ''}.`
        : severity === 'HIGH'
        ? `High severity signal identified${hasInstallScript ? ' (with install-time hooks)' : ''}.`
        : `Moderate or unclassified capability (${severity}).`,
  });

  // Evaluate Rules Deterministically
  if (severity === 'UNKNOWN' && independentSourceCount === 0 && osvMatched === null) {
    return {
      riskLevel: 'UNKNOWN',
      statusExplanation: 'Lookups inconclusive. Threat posture is UNKNOWN; not verified as safe.',
      ruleFired: 'RULE_UNKNOWN_NEVER_SAFE: Inconclusive lookups preserve unknown state, never assumed safe.',
      isSafe: false,
      gates,
    };
  }

  // Known OSV Match
  if (osvMatched === true && exactVersionMatched) {
    const level = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    return {
      riskLevel: level,
      statusExplanation: `Known registry baseline advisory matched installed version (${level}).`,
      ruleFired: `RULE_OSV_MATCH: Known advisory in OSV matching installed package version.`,
      isSafe: false,
      gates,
    };
  }

  // >= 2 independent + exact version + CRITICAL
  if (independentSourceCount >= 2 && exactVersionMatched && severity === 'CRITICAL') {
    return {
      riskLevel: 'CRITICAL',
      statusExplanation: 'Critical malicious capability verified across ≥2 independent sources with exact version match.',
      ruleFired: 'RULE_CRITICAL_MULTI_SOURCE: ≥2 independent sources + exact version match + critical payload.',
      isSafe: false,
      gates,
    };
  }

  // >= 2 independent + exact version + HIGH
  if (independentSourceCount >= 2 && exactVersionMatched && severity === 'HIGH') {
    return {
      riskLevel: 'HIGH',
      statusExplanation: 'High threat signals corroborated across ≥2 independent sources with exact version match.',
      ruleFired: 'RULE_HIGH_MULTI_SOURCE: ≥2 independent sources + exact version match.',
      isSafe: false,
      gates,
    };
  }

  // Single source only: CAPPED AT WATCH AT MOST
  if (independentSourceCount === 1) {
    return {
      riskLevel: 'WATCH',
      statusExplanation: 'Single public signal detected. Capped at WATCH to avoid crying wolf without corroboration.',
      ruleFired: 'RULE_SINGLE_SOURCE_WATCH: Single source signal cannot escalate beyond WATCH.',
      isSafe: false,
      gates,
    };
  }

  // Multiple sources but unconfirmed version: CAPPED AT WATCH
  if (independentSourceCount >= 2 && !exactVersionMatched) {
    return {
      riskLevel: 'WATCH',
      statusExplanation: 'Multiple public signals found, but exact installed version match is unconfirmed.',
      ruleFired: 'RULE_VERSION_UNCONFIRMED_WATCH: Version match unconfirmed; capped at WATCH.',
      isSafe: false,
      gates,
    };
  }

  // Zero sources, clean OSV
  if (independentSourceCount === 0 && osvMatched === false) {
    return {
      riskLevel: 'INFO',
      statusExplanation: 'No credible early signals found and baseline OSV lookup verified clean.',
      ruleFired: 'RULE_CLEAN_BASELINE_INFO: Clean baseline and zero anomalous public signals.',
      isSafe: true, // Only when verified clean baseline
      gates,
    };
  }

  // Zero sources, unverified OSV (unknown cannot be declared safe)
  return {
    riskLevel: 'INFO',
    statusExplanation: 'No early public signals detected; baseline OSV unverified. Not verified safe.',
    ruleFired: 'RULE_NO_SIGNALS_UNVERIFIED: Zero public signals, baseline unverified (never assumed safe).',
    isSafe: false,
    gates,
  };
}
