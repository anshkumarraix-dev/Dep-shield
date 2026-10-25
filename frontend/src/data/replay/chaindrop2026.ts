import { ReplayCase } from './types';

export const chaindrop2026Case: ReplayCase = {
  id: 'chaindrop-2026',
  title: 'ChainDrop: Self-Propagating npm Worm (Aug 2026)',
  dateStr: '2026-08-04',
  asOfDate: '2026-08-04T09:35:00Z',
  description:
    'Self-propagating npm worm compromising keyv and Cacheable family packages via malicious preinstall hooks, stolen tokens, and rapid multi-package infection.',
  headlinePackage: 'keyv',
  headlineVersion: '6.0.0',
  directDependency: true,
  mechanism:
    'preinstall runs node setup.mjs; payload files named Math_Symbol.js or math_init.js steal developer npm tokens and publish automated infected releases.',
  cveStatus: 'not verified',
  reconstructedDisclaimer:
    'IMPORTANT: This timeline was reconstructed by researchers from GH Archive after the fact. DepShield replay demonstrates historical query cutoff, not live real-time detection.',
  leadTime: {
    firstSignalTime: '09:02:37',
    registryPublishTime: '09:35:00',
    computedDisplay: '32m23s',
    description:
      'Reconstructed lead time: 32m23s from earliest recovered commit (09:02:37 UTC) to npm publish (09:35:00 UTC). Public comment warning (09:08:18 UTC) yielded 26m42s lead time.',
  },
  disputedScale: [
    {
      source: 'Elastic & Microsoft Defender',
      claim: '400+ packages compromised',
      citationUrl: 'https://www.elastic.co/security-labs/shai-hulud-chaindrop-npm-supply-chain',
    },
    {
      source: 'Aikido Security',
      claim: '444 packages and 1,381 versions affected',
      citationUrl: 'https://www.aikido.dev/blog/keyv-and-friends-compromised-in-npm-supply-chain-attack',
    },
    {
      source: 'Singapore CSA (Cyber Security Agency)',
      claim: 'Over 1,300 versions impacted',
      citationUrl: 'https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009/',
    },
  ],
  iocs: [
    {
      id: 'ioc-1',
      indicator: 'npm-cache.com',
      defanged: 'npm-cache[.]com',
      type: 'c2_domain',
      notes: 'Primary exfiltration domain for stolen npm auth tokens.',
    },
    {
      id: 'ioc-2',
      indicator: 'awqhnjewqjkl.icu',
      defanged: 'awqhnjewqjkl[.]icu',
      type: 'c2_domain',
      notes: 'Secondary staging C2 endpoint observed in setup.mjs.',
    },
    {
      id: 'ioc-3',
      indicator: 'pypi-get.com',
      defanged: 'pypi-get[.]com',
      type: 'c2_domain',
      notes: 'Cross-registry infrastructure associated with token drop.',
    },
    {
      id: 'ioc-4',
      indicator: 'js-mirror.com',
      defanged: 'js-mirror[.]com',
      type: 'c2_domain',
      notes: 'Malicious payload mirror used during worm propagation.',
    },
  ],
  timeline: [
    {
      id: 'ev-1',
      timestamp: '09:02:37',
      timeSeconds: 32557, // 09:02:37 UTC
      lane: 'public_signals',
      sourceName: 'Datadog Security Labs',
      sourceDomain: 'securitylabs.datadoghq.com',
      sourceUrl: 'https://securitylabs.datadoghq.com/articles/npm-worm-compromises-popular-npm-packages/',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'The earliest recovered malicious commit adds setup.mjs, Math_Symbol.js and a malicious preinstall in a keyv fork.',
      quote: 'adds setup.mjs, Math_Symbol.js and a malicious preinstall',
      category: 'commit',
      isQuoteVerified: true,
      notes: 'Earliest recovered malicious commit discovered in public Git reflog.',
    },
    {
      id: 'ev-2',
      timestamp: '09:08:18',
      timeSeconds: 32898, // 09:08:18 UTC
      lane: 'public_signals',
      sourceName: 'GitHub Discussion / Aikido',
      sourceDomain: 'aikido.dev',
      sourceUrl: 'https://www.aikido.dev/blog/keyv-and-friends-compromised-in-npm-supply-chain-attack',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'A public comment on the repository warned: Do not merge or publish until the repository and credentials are investigated.',
      quote: 'Do not merge or publish until the repository and credentials are investigated.',
      category: 'comment',
      isQuoteVerified: true,
      notes: 'Public warning posted 26 minutes before npm registry publication.',
    },
    {
      id: 'ev-3',
      timestamp: '09:35:00',
      timeSeconds: 34500, // 09:35:00 UTC
      lane: 'registry_reality',
      sourceName: 'npm Registry Manifest',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/keyv',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'At 09:35:00 UTC keyv@6.0.0 confirmed malicious, published to npm registry containing token exfiltration scripts.',
      quote: 'keyv@6.0.0 confirmed malicious, published to npm',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'First malicious package version published to public npm registry.',
    },
    {
      id: 'ev-4',
      timestamp: '10:09:44',
      timeSeconds: 36584, // 10:09:44 UTC
      lane: 'registry_reality',
      sourceName: 'npm Registry Multi-Publish',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/cacheable',
      isIndependentOriginal: false,
      exactVersionMatched: true,
      packageTargeted: 'cacheable',
      versionTargeted: '2.5.1',
      excerpt:
        'Between 10:09:44 and 10:14:41 nine Cacheable-family versions published to npm including flat-cache and cacheable-request.',
      quote: 'nine Cacheable-family versions published',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Worm automated publication across downstream Cacheable family.',
    },
    {
      id: 'ev-5',
      timestamp: '10:14:41',
      timeSeconds: 36881, // 10:14:41 UTC
      lane: 'registry_reality',
      sourceName: 'npm Registry Timeline',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/flat-cache',
      isIndependentOriginal: false,
      exactVersionMatched: true,
      packageTargeted: 'flat-cache',
      versionTargeted: '6.1.24',
      excerpt:
        'Downstream infection reached flat-cache@6.1.24, cacheable-request@13.0.20, @cacheable/memory@2.2.1, file-entry-cache@11.1.6, cache-manager@7.2.10.',
      quote: 'flat-cache@6.1.24, cacheable-request@13.0.20, @cacheable/memory@2.2.1',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Full Cacheable family package compromise wave.',
    },
    {
      id: 'ev-6',
      timestamp: '11:30:00',
      timeSeconds: 41400, // 11:30:00 UTC
      lane: 'public_signals',
      sourceName: 'Elastic Security Labs',
      sourceDomain: 'elastic.co',
      sourceUrl: 'https://www.elastic.co/security-labs/shai-hulud-chaindrop-npm-supply-chain',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'Elastic identified the worm mechanism: preinstall runs node setup.mjs with payload files named Math_Symbol.js or math_init.js.',
      quote: 'preinstall runs node setup.mjs with payload files named Math_Symbol.js or math_init.js',
      category: 'blog',
      isQuoteVerified: true,
      notes: 'Detailed reverse-engineering of self-propagating mechanism.',
    },
    {
      id: 'ev-7',
      timestamp: '12:45:00',
      timeSeconds: 45900, // 12:45:00 UTC
      lane: 'public_signals',
      sourceName: 'Microsoft Defender Blog',
      sourceDomain: 'microsoft.com',
      sourceUrl: 'https://www.microsoft.com/en-us/security/blog/2026/08/04/chaindrop-supply-chain-compromise-anatomy-self-propagating-worm/',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'Microsoft confirmed credential theft, then self-propagation using stolen npm tokens across ecosystem packages.',
      quote: 'credential theft, then self-propagation using stolen npm tokens',
      category: 'blog',
      isQuoteVerified: true,
      notes: 'Analysis of automated worm publication loop.',
    },
    {
      id: 'ev-8',
      timestamp: '14:10:00',
      timeSeconds: 51000, // 14:10:00 UTC
      lane: 'public_signals',
      sourceName: 'Singapore CSA Advisory',
      sourceDomain: 'csa.gov.sg',
      sourceUrl: 'https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009/',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'keyv',
      versionTargeted: '6.0.0',
      excerpt:
        'Singapore CSA published advisory AD-2026-009 warning over 1,300 versions impacted across popular registry mirrors.',
      quote: 'over 1,300 versions',
      category: 'advisory',
      isQuoteVerified: true,
      notes: 'National CSIRT emergency alert.',
    },
  ],
  lockfileContent: JSON.stringify(
    {
      name: 'financial-ledger-service',
      version: '3.4.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'financial-ledger-service',
          version: '3.4.0',
          dependencies: {
            keyv: '6.0.0',
            express: '^4.19.2',
            axios: '^1.6.8',
          },
        },
        'node_modules/keyv': {
          version: '6.0.0',
          resolved: 'https://registry.npmjs.org/keyv/-/keyv-6.0.0.tgz',
          hasInstallScript: true,
          dependencies: {
            'flat-cache': '6.1.24',
          },
        },
        'node_modules/flat-cache': {
          version: '6.1.24',
          resolved: 'https://registry.npmjs.org/flat-cache/-/flat-cache-6.1.24.tgz',
          hasInstallScript: true,
          dependencies: {
            'cacheable-request': '13.0.20',
          },
        },
        'node_modules/cacheable-request': {
          version: '13.0.20',
          resolved: 'https://registry.npmjs.org/cacheable-request/-/cacheable-request-13.0.20.tgz',
        },
        'node_modules/express': {
          version: '4.19.2',
          resolved: 'https://registry.npmjs.org/express/-/express-4.19.2.tgz',
          dependencies: {
            accepts: '1.3.8',
          },
        },
        'node_modules/accepts': {
          version: '1.3.8',
          resolved: 'https://registry.npmjs.org/accepts/-/accepts-1.3.8.tgz',
        },
        'node_modules/axios': {
          version: '1.6.8',
          resolved: 'https://registry.npmjs.org/axios/-/axios-1.6.8.tgz',
        },
      },
    },
    null,
    2
  ),
};
