import { fileURLToPath } from 'node:url';
import { readStdin, createHookHandler } from './common.js';

const HEDGE_CONJUNCTIONS = new Set([
  'but', 'however', 'nevertheless', 'nonetheless', 'yet',
  'although', 'though', 'whereas', 'while',
  '不过', '但是', '但', '然而', '却', '虽然', '尽管',
]);
const CLAUSE_SEPARATORS = new Set([',', '，', ';', '；']);
const MAX_WORD_COUNT = 10;

const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

export interface DetectResult {
  flagged_clauses: string[];
}

export function splitClauses(text: string): string[] {
  const clauses: string[] = [];
  let current: string[] = [];
  for (const seg of segmenter.segment(text)) {
    if (CLAUSE_SEPARATORS.has(seg.segment.trim())) {
      const clause = current.join('').trim();
      if (clause) clauses.push(clause);
      current = [];
    } else {
      current.push(seg.segment);
    }
  }
  const tail = current.join('').trim();
  if (tail) clauses.push(tail);
  return clauses;
}

export function isHedging(clause: string): boolean {
  const segments = Array.from(segmenter.segment(clause));
  if (segments.filter(s => s.isWordLike).length >= MAX_WORD_COUNT) return false;
  return segments.some(s => HEDGE_CONJUNCTIONS.has(s.segment.trim().toLowerCase()));
}

export function detect(text: string): DetectResult {
  return { flagged_clauses: splitClauses(text).filter(isHedging) };
}

export function blockDecision(result: DetectResult | undefined): { decision: string; reason: string } | null {
  const flagged = result?.flagged_clauses ?? [];
  if (flagged.length === 0) return null;
  return {
    decision: 'block',
    reason:
      `These clauses in your last message contain hedging patterns:\n${flagged.map(c => `  - "${c}"`).join('\n')}\n` +
      'Short hedged statements like \'X but Y\' suggest you are uncertain and ' +
      'may be hallucinating. Re-research the topic using your tools before ' +
      'answering. Do not rely on vague claims — verify the facts or say you ' +
      "don't know.",
  };
}

export const run = createHookHandler('anti-cheat-hedging.jsonl', detect, blockDecision);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readStdin().then(run).then(out => { if (out !== undefined) console.log(out); });
}
