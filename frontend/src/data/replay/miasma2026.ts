import { ReplayCase } from './types';

export const miasma2026Case: ReplayCase = {
  id: 'miasma-redhat-2026',
  title: 'Miasma: Red Hat npm Supply Chain Compromise (Jun 2026)',
  dateStr: '2026-06-01',
  asOfDate: '2026-06-01T04:12:00Z',
  description:
    'Targeted supply-chain attack altering 32 @redhat-cloud-services packages via preinstall scripts and binding.gyp after developer account compromise.',
  headlinePackage: '@redhat-cloud-services/frontend-components',
  headlineVersion: '4.2.1',
  directDependency: true,
  mechanism:
    'Altered npm releases execute install-time preinstall scripts; subsequent waves abused native binding.gyp compilation hooks.',
  cveStatus: 'not verified',
  reconstructedDisclaimer:
    'Reconstructed from Red Hat security bulletins (RHSB-2026-006) and Wiz threat research. DepShield replay models cutoff date, not live detection.',
  leadTime: {
    firstSignalTime: '08:00:00',
    registryPublishTime: '04:12:00',
    computedDisplay: 'Historical Analysis',
    description:
      'Developer account compromised on 29 May via malicious VS Code extension; malicious package wave published on 1 Jun 2026.',
  },
  disputedScale: [
    {
      source: 'Red Hat Security Bulletin',
      claim: '32 package releases altered in @redhat-cloud-services scope',
      citationUrl: 'https://access.redhat.com/security/vulnerabilities/RHSB-2026-006',
    },
    {
      source: 'Wiz Research',
      claim: 'Targeted account compromise impacting internal hybrid cloud UI modules',
      citationUrl: 'https://www.wiz.io/blog/miasma-supply-chain-attack-targeting-redhat-npm-packages',
    },
  ],
  iocs: [
    {
      id: 'ioc-m1',
      indicator: 'redhat-metrics.com',
      defanged: 'redhat-metrics[.]com',
      type: 'c2_domain',
      notes: 'Spoofed exfiltration endpoint embedded in altered preinstall hook.',
    },
    {
      id: 'ioc-m2',
      indicator: 'telemetry-sync.org',
      defanged: 'telemetry-sync[.]org',
      type: 'c2_domain',
      notes: 'Secondary dropper mirror used by binding.gyp payload.',
    },
  ],
  timeline: [
    {
      id: 'ev-m1',
      timestamp: '2026-05-29 08:00:00',
      timeSeconds: 1780041600, // 2026-05-29T08:00:00Z
      lane: 'public_signals',
      sourceName: 'Red Hat Security Bulletin',
      sourceDomain: 'access.redhat.com',
      sourceUrl: 'https://access.redhat.com/security/vulnerabilities/RHSB-2026-006',
      isIndependentOriginal: true,
      exactVersionMatched: false,
      packageTargeted: '@redhat-cloud-services/frontend-components',
      versionTargeted: '4.2.1',
      excerpt:
        'Red Hat confirmed an external account compromise on 29 May via a malicious third-party VS Code extension leading to altered packages.',
      quote: 'account compromise on 29 May via a malicious third-party VS Code extension',
      category: 'commit',
      isQuoteVerified: true,
      notes: 'Root cause identified as credential harvesting via Trojanized developer IDE extension.',
    },
    {
      id: 'ev-m2',
      timestamp: '2026-06-01 04:12:00',
      timeSeconds: 1780287120, // 2026-06-01T04:12:00Z
      lane: 'registry_reality',
      sourceName: 'npm Registry Release Log',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/@redhat-cloud-services/frontend-components',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: '@redhat-cloud-services/frontend-components',
      versionTargeted: '4.2.1',
      excerpt:
        'At 04:12:00 UTC @redhat-cloud-services/frontend-components@4.2.1 published to npm registry containing suspicious build hooks.',
      quote: '@redhat-cloud-services/frontend-components@4.2.1 published to npm registry',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Altered release published with preinstall execution scripts.',
    },
    {
      id: 'ev-m3',
      timestamp: '2026-06-01 09:20:00',
      timeSeconds: 1780305600, // 2026-06-01T09:20:00Z
      lane: 'public_signals',
      sourceName: 'Wiz Security Research',
      sourceDomain: 'wiz.io',
      sourceUrl: 'https://www.wiz.io/blog/miasma-supply-chain-attack-targeting-redhat-npm-packages',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: '@redhat-cloud-services/frontend-components',
      versionTargeted: '4.2.1',
      excerpt:
        'Wiz researchers discovered the Miasma campaign altering 32 packages using install-time preinstall scripts and binding.gyp compilation hooks.',
      quote: 'altering 32 packages using install-time preinstall scripts',
      category: 'blog',
      isQuoteVerified: true,
      notes: 'Technical analysis detailing hook injection and binding.gyp abuse.',
    },
    {
      id: 'ev-m4',
      timestamp: '2026-06-01 11:45:00',
      timeSeconds: 1780314300, // 2026-06-01T11:45:00Z
      lane: 'public_signals',
      sourceName: 'Red Hat Incident Response (RHSB-2026-006)',
      sourceDomain: 'access.redhat.com',
      sourceUrl: 'https://access.redhat.com/security/vulnerabilities/RHSB-2026-006',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: '@redhat-cloud-services/frontend-components',
      versionTargeted: '4.2.1',
      excerpt:
        'Advisory RHSB-2026-006 revoked npm auth tokens and unpublished all 32 altered package versions.',
      quote: 'revoked npm auth tokens and unpublished all 32 altered package versions',
      category: 'advisory',
      isQuoteVerified: true,
      notes: 'Official vendor remediation and token revocation.',
    },
  ],
  lockfileContent: JSON.stringify(
    {
      name: 'cloud-console-dashboard',
      version: '1.2.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'cloud-console-dashboard',
          version: '1.2.0',
          dependencies: {
            '@redhat-cloud-services/frontend-components': '4.2.1',
            react: '^18.2.0',
          },
        },
        'node_modules/@redhat-cloud-services/frontend-components': {
          version: '4.2.1',
          resolved:
            'https://registry.npmjs.org/@redhat-cloud-services/frontend-components/-/frontend-components-4.2.1.tgz',
          hasInstallScript: true,
          dependencies: {
            clsx: '^2.0.0',
          },
        },
        'node_modules/clsx': {
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/clsx/-/clsx-2.0.0.tgz',
        },
        'node_modules/react': {
          version: '18.2.0',
          resolved: 'https://registry.npmjs.org/react/-/react-18.2.0.tgz',
        },
      },
    },
    null,
    2
  ),
};
