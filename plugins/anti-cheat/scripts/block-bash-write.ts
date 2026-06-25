import { fileURLToPath } from 'node:url';

interface HookInput {
  tool_name: string;
  tool_input: { command?: string };
}

const GUARDED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rb', '.php', '.lua', '.sh', '.bash', '.zsh',
  '.sql', '.r', '.scala', '.zig', '.hs', '.ex', '.exs',
  '.vue', '.svelte',
  '.md',
]);

const CONTENT_WRITE_PATTERNS: RegExp[] = [
  /(?:^|[^2&=-])>/,   // redirect; excludes stderr 2>, &>, and arrows -> =>
  /\btee\b/,
  /\bsed\s.*-i/,
  /\bperl\s.*-\w*i/,
  /\bsponge\b/,
  /\bpatch\b/,
];

function extOf(token: string): string {
  const cleaned = token.replace(/['";:\\)}\]]+$/g, '');
  const dot = cleaned.lastIndexOf('.');
  if (dot < 0) return '';
  return cleaned.slice(dot).toLowerCase();
}

export function hasGuardedFile(command: string): boolean {
  for (const token of command.split(/\s+/)) {
    if (GUARDED_EXTS.has(extOf(token))) return true;
  }
  return false;
}

export function hasContentWrite(command: string): boolean {
  return CONTENT_WRITE_PATTERNS.some(p => p.test(command));
}

const HEREDOC_OPEN = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1/g;

// Drop heredoc bodies; they are stdin data, not shell. A real write redirect
// always sits on the opening line (`cat > f.ts <<EOF`), which is kept, so this
// never hides one — it only stops body text like a commit message from matching.
export function stripHeredocs(command: string): string {
  const kept: string[] = [];
  const pending: string[] = [];   // delimiters awaiting their closing line, in order
  for (const line of command.split('\n')) {
    if (pending.length > 0) {
      if (line.trim() === pending[0]) pending.shift();
      continue;
    }
    kept.push(line);
    for (const m of line.matchAll(HEREDOC_OPEN)) pending.push(m[2]);
  }
  return kept.join('\n');
}

export function shouldBlock(command: string): boolean {
  const analyzed = stripHeredocs(command).trim();
  if (analyzed === '') return false;
  return hasContentWrite(analyzed) && hasGuardedFile(analyzed);
}

export function checkBashWrite(input: HookInput): { blocked: boolean; command: string } {
  if (input.tool_name !== 'Bash') return { blocked: false, command: '' };
  const command = input.tool_input.command ?? '';
  return { blocked: shouldBlock(command), command };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(await readStdin());
  const result = checkBashWrite(input);
  if (!result.blocked) return;

  const decision = {
    decision: 'block',
    reason:
      'Use the Edit or Write tool instead of Bash to create or modify code and ' +
      'documentation files. Bash-based writes bypass skill-loading hooks.',
  };
  console.log(JSON.stringify(decision));
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {});
}
