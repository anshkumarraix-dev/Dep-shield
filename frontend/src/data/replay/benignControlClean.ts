import { ReplayCase } from './types';

export const benignControlCleanCase: ReplayCase = {
  id: 'benign-control-clean',
  title: 'Benign Control: Clean Project (Zero Alerts)',
  dateStr: '2026-01-01',
  asOfDate: '2026-01-01T00:00:00Z',
  description:
    'Standard modern Node.js application using patched, verified packages. Demonstrates that DepShield does not cry wolf on benign dependencies.',
  headlinePackage: 'lodash',
  headlineVersion: '4.17.21',
  directDependency: true,
  mechanism: 'Clean maintenance release. Zero malicious capability or payload.',
  cveStatus: 'clean (zero matching advisories)',
  reconstructedDisclaimer:
    'Baseline evaluation control. Verifies that patched versions (e.g. lodash 4.17.21) do not trigger false positive supply chain alerts.',
  leadTime: {
    firstSignalTime: '00:00:00',
    registryPublishTime: '00:00:00',
    computedDisplay: 'N/A (Clean)',
    description: 'No anomalous signals recorded; baseline verified clean in OSV.',
  },
  disputedScale: [
    {
      source: 'npm Registry & OSV Baseline',
      claim: '0 vulnerabilities detected in installed version set',
      citationUrl: 'https://osv.dev',
    },
  ],
  iocs: [],
  timeline: [
    {
      id: 'ev-bc1',
      timestamp: '2021-02-20 00:00:00',
      timeSeconds: 1613779200,
      lane: 'registry_reality',
      sourceName: 'npm Registry Release',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/lodash',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'lodash',
      versionTargeted: '4.17.21',
      excerpt:
        'Official patched release of lodash 4.17.21 published to npm fixing legacy prototype pollution issues.',
      quote: 'Official patched release of lodash 4.17.21 published to npm',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Clean patched version.',
    },
    {
      id: 'ev-bc2',
      timestamp: '2026-01-01 00:00:00',
      timeSeconds: 1767225600,
      lane: 'public_signals',
      sourceName: 'OSV Database Query',
      sourceDomain: 'osv.dev',
      sourceUrl: 'https://osv.dev',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'lodash',
      versionTargeted: '4.17.21',
      excerpt:
        'OSV database query returned zero active vulnerabilities matching lodash 4.17.21 installed.',
      quote: 'zero active vulnerabilities matching lodash 4.17.21',
      category: 'investigation',
      isQuoteVerified: true,
      notes: 'Confirmed clean baseline.',
    },
  ],
  lockfileContent: JSON.stringify(
    {
      name: 'secure-enterprise-app',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'secure-enterprise-app',
          version: '1.0.0',
          dependencies: {
            lodash: '4.17.21',
            express: '^4.19.2',
            chalk: '^5.3.0',
          },
        },
        'node_modules/lodash': {
          version: '4.17.21',
          resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          hasInstallScript: false,
        },
        'node_modules/express': {
          version: '4.19.2',
          resolved: 'https://registry.npmjs.org/express/-/express-4.19.2.tgz',
          hasInstallScript: false,
        },
        'node_modules/chalk': {
          version: '5.3.0',
          resolved: 'https://registry.npmjs.org/chalk/-/chalk-5.3.0.tgz',
          hasInstallScript: false,
        },
      },
    },
    null,
    2
  ),
};
