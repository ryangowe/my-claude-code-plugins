import * as fs from 'node:fs';
import * as path from 'node:path';

interface ContentBlock {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

interface TranscriptEntry {
  type?: string;
  message?: { content?: string | ContentBlock[] };
  [key: string]: unknown;
}

export function loadTranscript(filePath: string): TranscriptEntry[] {
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try { return JSON.parse(line); }
      catch { return { type: '_unparseable' }; }
    });
}

/**
 * Assistant text emitted since the last real user prompt.
 *
 * Both prompts and tool_results are type "user"; only prompts carry
 * string content, so a string-content user entry bounds the turn.
 */
export function lastTurnText(entries: TranscriptEntry[]): string {
  const texts: string[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const { type, message } = entries[i];
    if (type === 'user' && typeof message?.content === 'string') break;
    if (type === 'assistant' && Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          texts.push(block.text);
        }
      }
    }
  }
  return texts.reverse().join('\n\n');
}

export function capturePath(filename: string): string | null {
  const base = process.env.CLAUDE_PLUGIN_DATA;
  return base ? path.join(base, filename) : null;
}

export function appendCapture(filename: string, record: Record<string, unknown>): void {
  const p = capturePath(filename);
  if (!p) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, Buffer.from(JSON.stringify(record) + '\n', 'utf-8'));
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

const HOOK_FIELDS = ['hook_event_name', 'session_id', 'stop_hook_active', 'transcript_path'] as const;
const RAW_LIMIT = 2000;

export function createHookHandler<T>(
  captureFile: string,
  check: (text: string) => T | Promise<T>,
  decide: (result: T | undefined) => { decision: string; reason: string } | null,
): (raw: string) => Promise<string | undefined> {
  return async (raw) => {
    const record: Record<string, unknown> = { timestamp: new Date().toISOString() };
    let result: T | undefined;
    try {
      const input = JSON.parse(raw);
      record.input = Object.fromEntries(HOOK_FIELDS.map(k => [k, input[k]]));
      result = await check(lastTurnText(loadTranscript(input.transcript_path)));
      record.result = result;
    } catch (err) {
      const e = err as Error;
      record.error = `${e.constructor?.name ?? 'Error'}: ${e.message ?? err}`;
      record.raw = raw.slice(0, RAW_LIMIT);
    }
    try { appendCapture(captureFile, record); } catch { /* hooks must never disrupt Claude */ }
    const decision = decide(result);
    return decision ? JSON.stringify(decision) : undefined;
  };
}
