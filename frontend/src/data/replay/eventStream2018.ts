import { ReplayCase } from './types';

export const eventStream2018Case: ReplayCase = {
  id: 'event-stream-2018',
  title: 'event-stream / flatmap-stream Supply Chain Injection (Nov 2018)',
  dateStr: '2018-11-26',
  asOfDate: '2018-11-26T00:00:00Z',
  description:
    'Targeted injection of flatmap-stream into event-stream 3.3.6 stealing Bitcoin wallet private keys from Copay applications.',
  headlinePackage: 'event-stream',
  headlineVersion: '3.3.6',
  directDependency: true,
  mechanism:
    'Transfer of package ownership to untrusted actor right9ctrl, who injected encrypted bytecode targeting BitPay Copay wallets.',
  cveStatus: 'GHSA-7fh8-383t-2463 (OSV matched post-cutoff)',
  reconstructedDisclaimer:
    'Reconstructed from GitHub issue #116 and npm incident report. Live OSV record GHSA-7fh8-383t-2463 was published post-cutoff.',
  leadTime: {
    firstSignalTime: '2018-11-20',
    registryPublishTime: '2018-11-26',
    computedDisplay: '6 days',
    description:
      'First public report in GitHub issue #116 on 20 Nov 2018; npm security incident report published on 26 Nov 2018.',
  },
  disputedScale: [
    {
      source: 'npm Incident Report',
      claim: 'Nearly 8 million weekly downloads of event-stream impacted',
      citationUrl: 'https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident',
    },
    {
      source: 'GitHub Issue #116',
      claim: 'Targeted Copay wallet credential theft via obfuscated payload',
      citationUrl: 'https://github.com/dominictarr/event-stream/issues/116',
    },
  ],
  iocs: [
    {
      id: 'ioc-es1',
      indicator: 'copay-wallet',
      defanged: 'copay[.]app',
      type: 'c2_domain',
      notes: 'Decrypted payload selectively executed inside Copay application environment.',
    },
  ],
  timeline: [
    {
      id: 'ev-es1',
      timestamp: '2018-09-09 00:00:00',
      timeSeconds: 1536451200,
      lane: 'registry_reality',
      sourceName: 'npm Registry Publish',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'flatmap-stream',
      versionTargeted: '0.1.1',
      excerpt:
        'Malicious flatmap-stream 0.1.1 published to npm registry containing encrypted targeted bytecode payload.',
      quote: 'Malicious flatmap-stream 0.1.1 published to npm',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Silent dependency injection into event-stream 3.3.6.',
    },
    {
      id: 'ev-es2',
      timestamp: '2018-11-20 00:00:00',
      timeSeconds: 1542672000,
      lane: 'public_signals',
      sourceName: 'GitHub Issue #116 (FallingSnow)',
      sourceDomain: 'github.com',
      sourceUrl: 'https://github.com/dominictarr/event-stream/issues/116',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'event-stream',
      versionTargeted: '3.3.6',
      excerpt:
        'GitHub issue #116 opened by user FallingSnow asking why flatmap-stream was added without explanation.',
      quote: 'GitHub issue #116 opened by user FallingSnow',
      category: 'comment',
      isQuoteVerified: true,
      notes: 'First verifiable public signal identifying the anomalous dependency.',
    },
    {
      id: 'ev-es3',
      timestamp: '2018-11-26 00:00:00',
      timeSeconds: 1543190400,
      lane: 'public_signals',
      sourceName: 'npm Official Incident Report',
      sourceDomain: 'blog.npmjs.org',
      sourceUrl: 'https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'event-stream',
      versionTargeted: '3.3.6',
      excerpt:
        'npm blog incident report published confirming targeted wallet credential exfiltration in flatmap-stream.',
      quote: 'npm blog incident report published',
      category: 'advisory',
      isQuoteVerified: true,
      notes: 'Official npm triage and removal of malicious versions.',
    },
  ],
  lockfileContent: JSON.stringify(
    {
      name: 'copay-demo-suite',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: {
        '': {
          name: 'copay-demo-suite',
          dependencies: {
            'event-stream': '3.3.6',
          },
        },
        'node_modules/event-stream': {
          version: '3.3.6',
          resolved: 'https://registry.npmjs.org/event-stream/-/event-stream-3.3.6.tgz',
          dependencies: {
            'flatmap-stream': '0.1.1',
          },
        },
        'node_modules/flatmap-stream': {
          version: '0.1.1',
          resolved: 'https://registry.npmjs.org/flatmap-stream/-/flatmap-stream-0.1.1.tgz',
          hasInstallScript: false,
        },
      },
    },
    null,
    2
  ),
};
