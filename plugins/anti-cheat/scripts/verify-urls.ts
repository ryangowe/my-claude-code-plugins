import { fileURLToPath } from 'node:url';
import { readStdin, createHookHandler } from './common.js';

const URL_RE = /https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+/g;
const TRAILING_PUNCT = '.,;:!?';
const TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; anti-cheat-hook)';
const PRESENT_STATUSES = new Set([401, 403, 429]);

export interface UrlCheckResult {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface VerifyResult {
  urls: UrlCheckResult[];
}

export function findUrls(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0];
    while (url.length > 0 && TRAILING_PUNCT.includes(url[url.length - 1])) {
      url = url.slice(0, -1);
    }
    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }
  return result;
}

export async function checkUrl(url: string): Promise<UrlCheckResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      return { url, ok: res.ok || PRESENT_STATUSES.has(res.status), status: res.status };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const e = err as Error;
    return { url, ok: false, error: `${e.constructor?.name ?? 'Error'}: ${e.message ?? err}` };
  }
}

export async function verify(text: string): Promise<VerifyResult> {
  const urls = findUrls(text);
  if (urls.length === 0) return { urls: [] };
  const settled = await Promise.allSettled(urls.map(checkUrl));
  return {
    urls: settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { url: urls[i], ok: false, error: String(r.reason) },
    ),
  };
}

export function blockDecision(result: VerifyResult | undefined): { decision: string; reason: string } | null {
  const dead = (result?.urls ?? []).filter(u => !u.ok).map(u => u.url);
  if (dead.length === 0) return null;
  return {
    decision: 'block',
    reason:
      `These URLs in your last message could not be reached:\n${dead.map(u => `  - ${u}`).join('\n')}\n` +
      'They look like fabricated citations. Re-answer the user without them: cite ' +
      'only URLs you are sure are real, or say you could not find a source.',
  };
}

export const run = createHookHandler('anti-cheat-capture.jsonl', verify, blockDecision);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readStdin().then(run).then(out => { if (out !== undefined) console.log(out); });
}
