import { ReplayCase } from './types';
import { chaindrop2026Case } from './chaindrop2026';
import { miasma2026Case } from './miasma2026';
import { eventStream2018Case } from './eventStream2018';
import { uaParserJs2021Case } from './uaParserJs2021';
import { benignControlCleanCase } from './benignControlClean';

export * from './types';
export { chaindrop2026Case } from './chaindrop2026';
export { miasma2026Case } from './miasma2026';
export { eventStream2018Case } from './eventStream2018';
export { uaParserJs2021Case } from './uaParserJs2021';
export { benignControlCleanCase } from './benignControlClean';

export const REPLAY_CASES: ReplayCase[] = [
  chaindrop2026Case, // Headline default case
  miasma2026Case,
  eventStream2018Case,
  uaParserJs2021Case,
  benignControlCleanCase,
];

export const REPLAY_CASES_MAP = new Map<string, ReplayCase>(
  REPLAY_CASES.map((c) => [c.id, c])
);

export function getReplayCase(id: string): ReplayCase {
  return REPLAY_CASES_MAP.get(id) || chaindrop2026Case;
}
