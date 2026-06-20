import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface HookInput {
  tool_name: string;
  tool_input: { file_path?: string };
  transcript_path: string;
}

interface TranscriptEntry {
  type?: string;
  message?: {
    content?: Array<{ type?: string; name?: string; input?: { skill?: string } }>;
  };
}

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rb', '.php', '.lua', '.sh', '.bash', '.zsh',
  '.sql', '.r', '.scala', '.zig', '.hs', '.ex', '.exs',
  '.vue', '.svelte',
]);

export function requiredSkills(input: HookInput): string[][] {
  if (input.tool_name !== 'Edit' && input.tool_name !== 'Write') return [];
  const file = input.tool_input.file_path ?? '';

  if (file.endsWith('.md')) return [['how-to-document']];

  const dot = file.lastIndexOf('.');
  if (dot >= 0 && CODE_EXTS.has(file.slice(dot))) return [['how-to-comment']];

  return [];
}

export function loadedSkills(transcriptPath: string): Set<string> {
  const loaded = new Set<string>();
  for (const line of readFileSync(transcriptPath, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let entry: TranscriptEntry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'assistant') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'Skill' && block.input?.skill) {
        const name = block.input.skill;
        loaded.add(name);
        const i = name.lastIndexOf(':');
        if (i >= 0) loaded.add(name.slice(i + 1));
      }
    }
  }
  return loaded;
}

export function missingSkills(required: string[][], loaded: Set<string>): string[] {
  const missing: string[] = [];
  for (const group of required) {
    if (!group.some(s => loaded.has(s))) {
      missing.push(group.length === 1 ? group[0] : group.join(' or '));
    }
  }
  return missing;
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
  const required = requiredSkills(input);
  if (required.length === 0) return;

  const missing = missingSkills(required, loadedSkills(input.transcript_path));
  if (missing.length === 0) return;

  process.stderr.write(`Load skill before editing: ${missing.join(', ')}\n`);
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {});
}
