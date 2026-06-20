import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { capturePath, appendCapture } from './common.js';
import { detect, splitClauses, isHedging, blockDecision, run } from './detect-hedging.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-hedging-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CLAUDE_PLUGIN_DATA;
});

function makeTranscript(assistantText: string): string {
  const p = path.join(tmpDir, 't.jsonl');
  const entries = [
    { type: 'user', message: { content: 'tell me about X' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: assistantText }] } },
  ];
  fs.writeFileSync(p, entries.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
  return p;
}

// -- splitClauses -------------------------------------------------------------

describe('splitClauses', () => {
  it('splits on ascii comma', () => {
    expect(splitClauses('it works, but slowly')).toEqual(['it works', 'but slowly']);
  });

  it('splits on fullwidth comma', () => {
    const clauses = splitClauses('可以，但是不太好');
    expect(clauses.length).toBe(2);
    expect(clauses[0].trim()).toBe('可以');
  });

  it('splits on semicolons', () => {
    expect(splitClauses('one; two；three').length).toBe(3);
  });

  it('drops empty clauses', () => {
    expect(splitClauses(',, hello ,')).toEqual(['hello']);
  });

  it('returns whole text when no separator', () => {
    expect(splitClauses('no separators here')).toEqual(['no separators here']);
  });
});

// -- isHedging ----------------------------------------------------------------

describe('isHedging', () => {
  it('detects but', () => expect(isHedging('but it may vary')).toBe(true));
  it('detects however', () => expect(isHedging('however this is uncertain')).toBe(true));
  it('detects chinese conjunction', () => expect(isHedging('但是不确定')).toBe(true));
  it('detects yet', () => expect(isHedging('yet unclear')).toBe(true));
  it('detects although', () => expect(isHedging('although uncertain')).toBe(true));
  it('is case insensitive', () => expect(isHedging('But maybe not')).toBe(true));
  it('ignores long clauses', () => {
    expect(isHedging('this is a perfectly reasonable clause but it has many words in it overall')).toBe(false);
  });
  it('clean clause returns false', () => expect(isHedging('the API returns JSON')).toBe(false));
});

// -- detect -------------------------------------------------------------------

describe('detect', () => {
  it('flags hedging clause', () => {
    const result = detect("it supports JSON, but I'm not sure about XML");
    expect(result.flagged_clauses.length).toBe(1);
    expect(result.flagged_clauses[0].toLowerCase()).toContain('but');
  });

  it('clean text returns no flags', () => {
    expect(detect('the function returns a list of integers').flagged_clauses).toEqual([]);
  });

  it('multiple hedges', () => {
    expect(detect('A works, but B might not, however C is fine').flagged_clauses.length).toBe(2);
  });

  it('chinese hedging', () => {
    expect(detect('这个方法可以，但是效果不太好').flagged_clauses.length).toBeGreaterThanOrEqual(1);
  });
});

// -- blockDecision ------------------------------------------------------------

describe('blockDecision', () => {
  it('flags hedging', () => {
    const decision = blockDecision({ flagged_clauses: ["but I'm not sure"] });
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe('block');
    expect(decision!.reason).toContain("but I'm not sure");
  });

  it('null when clean', () => {
    expect(blockDecision({ flagged_clauses: [] })).toBeNull();
  });
});

// -- capture ------------------------------------------------------------------

describe('capture', () => {
  it('capturePath uses plugin data', () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    expect(capturePath('anti-cheat-hedging.jsonl')).toBe(
      path.join(tmpDir, 'anti-cheat-hedging.jsonl'),
    );
  });

  it('capturePath is null without env', () => {
    delete process.env.CLAUDE_PLUGIN_DATA;
    expect(capturePath('anti-cheat-hedging.jsonl')).toBeNull();
  });

  it('appendCapture writes record', () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    appendCapture('anti-cheat-hedging.jsonl', { test: true });
    const record = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'anti-cheat-hedging.jsonl'), 'utf-8').trim(),
    );
    expect(record).toEqual({ test: true });
  });
});

// -- run (integration) --------------------------------------------------------

describe('run', () => {
  it('appends record and does not block on clean text', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const p = makeTranscript('this is a clean answer');
    const output = await run(JSON.stringify({ hook_event_name: 'Stop', transcript_path: p }));

    expect(output).toBeUndefined();
    const capFile = path.join(tmpDir, 'anti-cheat-hedging.jsonl');
    const record = JSON.parse(fs.readFileSync(capFile, 'utf-8').trimEnd().split('\n').pop()!);
    expect(record.result.flagged_clauses).toEqual([]);
    expect(record.error).toBeUndefined();
  });

  it('blocks on hedging text', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const p = makeTranscript("it works, but I'm not sure");
    const output = await run(JSON.stringify({ hook_event_name: 'Stop', transcript_path: p }));

    expect(output).toBeDefined();
    expect(JSON.parse(output!).decision).toBe('block');
  });

  it('handles bad input gracefully', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const output = await run('not json');

    expect(output).toBeUndefined();
    const capFile = path.join(tmpDir, 'anti-cheat-hedging.jsonl');
    const record = JSON.parse(fs.readFileSync(capFile, 'utf-8').trimEnd().split('\n').pop()!);
    expect(record.error).toBeDefined();
  });
});
