import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadTranscript, lastTurnText, capturePath, appendCapture } from './common.js';
import { findUrls, checkUrl, blockDecision, run } from './verify-urls.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-urls-test-'));
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('blocked: test attempted real network access');
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CLAUDE_PLUGIN_DATA;
});

function writeTranscript(entries: Record<string, unknown>[]): string {
  const p = path.join(tmpDir, 't.jsonl');
  fs.writeFileSync(p, entries.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
  return p;
}

function writeTranscriptWithDeadUrl(): string {
  return writeTranscript([
    { type: 'user', message: { content: 'got a source?' } },
    {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'see https://dead.example/x' }] },
    },
  ]);
}

// -- loadTranscript -----------------------------------------------------------

describe('loadTranscript', () => {
  it('parses lines and skips blanks', () => {
    const p = path.join(tmpDir, 't.jsonl');
    fs.writeFileSync(p, '{"type": "a"}\n\n{"type": "b"}\n', 'utf-8');
    expect(loadTranscript(p)).toEqual([{ type: 'a' }, { type: 'b' }]);
  });

  it('marks unparseable lines', () => {
    const p = path.join(tmpDir, 't.jsonl');
    fs.writeFileSync(p, '{"type": "a"}\nnot json\n', 'utf-8');
    expect(loadTranscript(p)).toEqual([
      { type: 'a' },
      { type: '_unparseable' },
    ]);
  });

  it('keeps lines holding a unicode line separator', () => {
    const entry = { type: 'assistant', text: `a${String.fromCharCode(0x2028)}b` };
    const p = path.join(tmpDir, 't.jsonl');
    fs.writeFileSync(p, JSON.stringify(entry) + '\n', 'utf-8');
    expect(loadTranscript(p)).toEqual([entry]);
  });
});

// -- lastTurnText -------------------------------------------------------------

describe('lastTurnText', () => {
  it('collects assistant text after the last user prompt', () => {
    const entries = [
      { type: 'user', message: { content: 'old prompt' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'old answer' }] } },
      { type: 'user', message: { content: 'new prompt' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'new answer' }] } },
    ];
    expect(lastTurnText(entries)).toBe('new answer');
  });

  it('treats a tool_result as inside the turn', () => {
    const entries = [
      { type: 'user', message: { content: 'real prompt' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'first' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'second' }] } },
    ];
    expect(lastTurnText(entries)).toBe('first\n\nsecond');
  });

  it('keeps only text blocks', () => {
    const entries = [
      { type: 'user', message: { content: 'prompt' } },
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'hmm' }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'part one' }] } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'X' }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'part two' }] } },
    ];
    expect(lastTurnText(entries)).toBe('part one\n\npart two');
  });

  it('without a user prompt uses every entry', () => {
    const entries = [
      { type: 'assistant', message: { content: [{ type: 'text', text: 'answer' }] } },
    ];
    expect(lastTurnText(entries)).toBe('answer');
  });
});

// -- findUrls -----------------------------------------------------------------

describe('findUrls', () => {
  it('strips trailing ascii punctuation', () => {
    expect(findUrls('see https://example.com/path.')).toEqual([
      'https://example.com/path',
    ]);
  });

  it('stops at non-ascii without a separating space', () => {
    expect(findUrls('link https://example.com/y，more text')).toEqual([
      'https://example.com/y',
    ]);
  });

  it('bounds on markdown and inline code delimiters', () => {
    expect(findUrls('[doc](https://example.org/) and `https://example.com/p` done')).toEqual([
      'https://example.org/',
      'https://example.com/p',
    ]);
  });

  it('deduplicates in first-seen order', () => {
    expect(findUrls('https://example.com/two https://example.com/one https://example.com/two')).toEqual([
      'https://example.com/two',
      'https://example.com/one',
    ]);
  });

  it('returns empty when there are none', () => {
    expect(findUrls('plain text, no links')).toEqual([]);
  });
});

// -- checkUrl -----------------------------------------------------------------

describe('checkUrl', () => {
  it('is ok on a 2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    expect(await checkUrl('https://example.com')).toEqual({
      url: 'https://example.com', ok: true, status: 200,
    });
  });

  it('is not ok on a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await checkUrl('https://example.com')).toEqual({
      url: 'https://example.com', ok: false, status: 404,
    });
  });

  it('is ok on a restricted but present status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    expect((await checkUrl('https://example.com')).ok).toBe(true);
  });

  it('is not ok on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const result = await checkUrl('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// -- capture ------------------------------------------------------------------

describe('capture', () => {
  it('capturePath uses the plugin data dir', () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    expect(capturePath('anti-cheat-capture.jsonl')).toBe(
      path.join(tmpDir, 'anti-cheat-capture.jsonl'),
    );
  });

  it('capturePath is null when the plugin data var is unset', () => {
    delete process.env.CLAUDE_PLUGIN_DATA;
    expect(capturePath('anti-cheat-capture.jsonl')).toBeNull();
  });

  it('appendCapture is a no-op when the plugin data var is unset', () => {
    delete process.env.CLAUDE_PLUGIN_DATA;
    appendCapture('anti-cheat-capture.jsonl', { a: 1 });
  });

  it('appendCapture writes one JSON line per record', () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const filename = 'anti-cheat-capture.jsonl';
    appendCapture(filename, { a: 1 });
    appendCapture(filename, { b: 2 });
    const lines = fs.readFileSync(path.join(tmpDir, filename), 'utf-8').trimEnd().split('\n');
    expect(lines.map(l => JSON.parse(l))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('tolerates a lone surrogate in a record', () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const filename = 'anti-cheat-capture.jsonl';
    appendCapture(filename, { text: `before${String.fromCharCode(0xdc86)}after` });
    const content = fs.readFileSync(path.join(tmpDir, filename), 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.text).toContain('before');
    expect(parsed.text).toContain('after');
  });
});

// -- blockDecision ------------------------------------------------------------

describe('blockDecision', () => {
  it('flags only the unreachable URLs', () => {
    const result = {
      urls: [
        { url: 'https://reachable.example', ok: true, status: 200 },
        { url: 'https://dead.example', ok: false, status: 404 },
      ],
    };
    const decision = blockDecision(result);
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe('block');
    expect(decision!.reason).toContain('https://dead.example');
    expect(decision!.reason).not.toContain('https://reachable.example');
  });

  it('is null when every URL resolves', () => {
    const result = {
      urls: [{ url: 'https://reachable.example', ok: true, status: 200 }],
    };
    expect(blockDecision(result)).toBeNull();
  });
});

// -- run (integration) --------------------------------------------------------

describe('run', () => {
  it('appends a capture record', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const transcriptPath = writeTranscript([
      { type: 'user', message: { content: 'do the thing' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'no links here' }] } },
    ]);
    const hookInput = JSON.stringify({ hook_event_name: 'Stop', transcript_path: transcriptPath });
    await run(hookInput);

    const capFile = path.join(tmpDir, 'anti-cheat-capture.jsonl');
    const record = JSON.parse(fs.readFileSync(capFile, 'utf-8').trimEnd().split('\n').pop()!);
    expect(record.input.hook_event_name).toBe('Stop');
    expect(record.result.urls).toEqual([]);
    expect(record.error).toBeUndefined();
  });

  it('records the error and never raises on bad input', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    await run('not valid json');

    const capFile = path.join(tmpDir, 'anti-cheat-capture.jsonl');
    const record = JSON.parse(fs.readFileSync(capFile, 'utf-8').trimEnd().split('\n').pop()!);
    expect(record.error).toBeDefined();
  });

  it('blocks the stop when the turn cites an unreachable URL', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const transcriptPath = writeTranscriptWithDeadUrl();
    const hookInput = JSON.stringify({ hook_event_name: 'Stop', transcript_path: transcriptPath });
    const output = await run(hookInput);

    expect(output).toBeDefined();
    const decision = JSON.parse(output!);
    expect(decision.decision).toBe('block');
    expect(decision.reason).toContain('https://dead.example/x');
  });

  it('blocks a retry too when it still cites an unreachable URL', async () => {
    process.env.CLAUDE_PLUGIN_DATA = tmpDir;
    const transcriptPath = writeTranscriptWithDeadUrl();
    const hookInput = JSON.stringify({
      hook_event_name: 'Stop',
      transcript_path: transcriptPath,
      stop_hook_active: true,
    });
    const output = await run(hookInput);

    expect(output).toBeDefined();
    expect(JSON.parse(output!).decision).toBe('block');
  });
});
