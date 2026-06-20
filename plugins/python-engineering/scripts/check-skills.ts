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

const TEST_FILE = /[/\\](test_[^/\\]+\.py|[^/\\]+_test\.py)$/;

export function requiredSkills(input: HookInput): string[][] {
  const file = input.tool_input.file_path ?? '';
  if (!file.endsWith('.py')) return [];

  if (input.tool_name === 'Write') {
    return [['how-to-structure-python-modules', 'how-to-structure-python-projects']];
  }

  if (input.tool_name !== 'Edit') return [];

  const groups: string[][] = [['how-to-write-pythonic-code']];
  if (TEST_FILE.test(file)) {
    groups.push(['how-to-write-python-tests']);
  }
  return groups;
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

  const skillList = missing.map(s => `  Skill({ skill: "${s}" })`).join('\n');
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Missing skill: ${missing.join(', ')}`,
      additionalContext:
        `Before editing this file, load the required skill(s) using the Skill tool:\n${skillList}\n` +
        'Do NOT read the SKILL.md file directly — use the Skill tool so the load is recorded in the transcript.',
    },
  };
  console.log(JSON.stringify(output));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {});
}
