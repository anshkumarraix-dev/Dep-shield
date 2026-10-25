import { ReplayCase } from './types';

export const uaParserJs2021Case: ReplayCase = {
  id: 'ua-parser-js-2021',
  title: 'ua-parser-js Maintainer Account Takeover (Oct 2021)',
  dateStr: '2021-10-22',
  asOfDate: '2021-10-22T23:59:00Z',
  description:
    'Hijacked npm maintainer account publishing credential-stealing trojans and cryptominers in versions 0.7.29, 0.8.0, and 1.0.0.',
  headlinePackage: 'ua-parser-js',
  headlineVersion: '0.7.29',
  directDependency: true,
  mechanism:
    'Malicious preinstall script executes batch/powershell dropper to download XMRig cryptominer and DanaBot password stealer.',
  cveStatus: 'GHSA-pjwm-rvh2-c87w',
  reconstructedDisclaimer:
    'Reconstructed from maintainer issue #536 and GHSA-pjwm-rvh2-c87w. DepShield replay models strict historical cutoff.',
  leadTime: {
    firstSignalTime: '2021-10-22 14:00:00',
    registryPublishTime: '2021-10-22 13:15:00',
    computedDisplay: '45m post-pub',
    description:
      'Maintainer discovered unauthorized release 45 minutes after automated publication and issued emergency advisory.',
  },
  disputedScale: [
    {
      source: 'GitHub Advisory Database',
      claim: 'Tens of millions of weekly downloads exposed across three malicious versions',
      citationUrl: 'https://github.com/advisories/GHSA-pjwm-rvh2-c87w',
    },
  ],
  iocs: [
    {
      id: 'ioc-ua1',
      indicator: 'citadelmikrotik.com',
      defanged: 'citadelmikrotik[.]com',
      type: 'c2_domain',
      notes: 'Trojan payload download server hosted on compromised router infrastructure.',
    },
    {
      id: 'ioc-ua2',
      indicator: '159.148.186.214',
      defanged: '159.148.186[.]214',
      type: 'ip',
      notes: 'Cryptominer staging IP referenced in preinstall script.',
    },
  ],
  timeline: [
    {
      id: 'ev-ua1',
      timestamp: '2021-10-22 13:15:00',
      timeSeconds: 1634908500,
      lane: 'registry_reality',
      sourceName: 'npm Registry Publish',
      sourceDomain: 'registry.npmjs.org',
      sourceUrl: 'https://registry.npmjs.org/ua-parser-js',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'ua-parser-js',
      versionTargeted: '0.7.29',
      excerpt:
        'Malicious ua-parser-js 0.7.29 published to npm registry via hijacked developer credentials.',
      quote: 'Malicious ua-parser-js 0.7.29 published to npm',
      category: 'registry_publish',
      isQuoteVerified: true,
      notes: 'Compromised version containing cryptominer and credential stealer.',
    },
    {
      id: 'ev-ua2',
      timestamp: '2021-10-22 14:00:00',
      timeSeconds: 1634911200,
      lane: 'public_signals',
      sourceName: 'Maintainer GitHub Issue #536',
      sourceDomain: 'github.com',
      sourceUrl: 'https://github.com/faisalman/ua-parser-js/issues/536',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'ua-parser-js',
      versionTargeted: '0.7.29',
      excerpt:
        'Maintainer GitHub issue warning published: I believe someone was hijacking my npm account and published compromised packages.',
      quote: 'Maintainer GitHub issue warning published',
      category: 'comment',
      isQuoteVerified: true,
      notes: 'Direct maintainer acknowledgment of credential theft.',
    },
    {
      id: 'ev-ua3',
      timestamp: '2021-10-22 18:00:00',
      timeSeconds: 1634925600,
      lane: 'public_signals',
      sourceName: 'GitHub Security Advisory',
      sourceDomain: 'github.com',
      sourceUrl: 'https://github.com/advisories/GHSA-pjwm-rvh2-c87w',
      isIndependentOriginal: true,
      exactVersionMatched: true,
      packageTargeted: 'ua-parser-js',
      versionTargeted: '0.7.29',
      excerpt:
        'GitHub Security Advisory published: GHSA-pjwm-rvh2-c87w warning of malware in ua-parser-js.',
      quote: 'GitHub Security Advisory published',
      category: 'advisory',
      isQuoteVerified: true,
      notes: 'Formal GHSA bulletin confirming malware execution.',
    },
  ],
  lockfileContent: JSON.stringify(
    {
      name: 'analytics-portal',
      version: '2.0.0',
      lockfileVersion: 2,
      packages: {
        '': {
          name: 'analytics-portal',
          dependencies: {
            'ua-parser-js': '0.7.29',
          },
        },
        'node_modules/ua-parser-js': {
          version: '0.7.29',
          resolved: 'https://registry.npmjs.org/ua-parser-js/-/ua-parser-js-0.7.29.tgz',
          hasInstallScript: true,
        },
      },
    },
    null,
    2
  ),
};
