import { fileURLToPath } from 'node:url';
import { readStdin, createHookHandler } from './common.js';

const HEDGE_CONJUNCTIONS = new Set([
  'but', 'however', 'nevertheless', 'nonetheless', 'yet',
  'although', 'though', 'whereas', 'while',
  '不过', '但是', '但', '然而', '却', '虽然', '尽管',
]);
const CLAUSE_SEPARATORS = new Set([',', '，', ';', '；']);
const SENTENCE_TERMINATORS = new Set(['.', '。', '!', '！', '?', '？']);
const MAX_WORD_COUNT = 10;

const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

export interface Clause {
  text: string;
  sentenceStart: boolean;
}

export interface DetectResult {
  flagged_clauses: string[];
}

export function splitClauses(text: string): Clause[] {
  const clauses: Clause[] = [];
  let current: string[] = [];
  let sentenceStart = true;
  for (const seg of segmenter.segment(text)) {
    const trimmed = seg.segment.trim();
    if (CLAUSE_SEPARATORS.has(trimmed)) {
      const clause = current.join('').trim();
      if (clause) clauses.push({ text: clause, sentenceStart });
      current = [];
      sentenceStart = false;
    } else if (SENTENCE_TERMINATORS.has(trimmed) || trimmed === '\n') {
      const clause = current.join('').trim();
      if (clause) clauses.push({ text: clause, sentenceStart });
      current = [];
      sentenceStart = true;
    } else {
      current.push(seg.segment);
    }
  }
  const tail = current.join('').trim();
  if (tail) clauses.push({ text: tail, sentenceStart });
  return clauses;
}

export function isHedging(clause: string, sentenceStart = false): boolean {
  const segments = Array.from(segmenter.segment(clause));
  const words = segments.filter(s => s.isWordLike);
  if (words.length >= MAX_WORD_COUNT) return false;
  if (sentenceStart) {
    const first = words[0]?.segment.trim().toLowerCase();
    if (first && HEDGE_CONJUNCTIONS.has(first)) return false;
  }
  return segments.some(s => HEDGE_CONJUNCTIONS.has(s.segment.trim().toLowerCase()));
}

export function detect(text: string): DetectResult {
  const flagged = splitClauses(text)
    .filter(c => isHedging(c.text, c.sentenceStart))
    .map(c => c.text);
  return { flagged_clauses: flagged };
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
