import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { requiredSkills, loadedSkills, missingSkills, sessionStartContext } from './check-skills.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-skills-basic-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTranscript(entries: Record<string, unknown>[]): string {
  const p = path.join(tmpDir, 'transcript.jsonl');
  fs.writeFileSync(p, entries.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
  return p;
}

function skillEntry(skill: string): Record<string, unknown> {
  return {
    type: 'assistant',
    message: {
      content: [{
        type: 'tool_use',
        id: 'toolu_test',
        name: 'Skill',
        input: { skill },
      }],
    },
  };
}

// -- requiredSkills -----------------------------------------------------------

describe('requiredSkills', () => {
  it('requires how-to-document for .md files', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/foo/README.md' }, transcript_path: '',
    })).toEqual([['how-to-document']]);
  });

  it('requires how-to-comment for code files', () => {
    for (const ext of ['.ts', '.py', '.go', '.rs', '.java', '.vue']) {
      expect(requiredSkills({
        tool_name: 'Edit', tool_input: { file_path: `/foo/bar${ext}` }, transcript_path: '',
      })).toEqual([['how-to-comment']]);
    }
  });

  it('requires how-to-comment for Write on code files', () => {
    expect(requiredSkills({
      tool_name: 'Write', tool_input: { file_path: '/foo/new.tsx' }, transcript_path: '',
    })).toEqual([['how-to-comment']]);
  });

  it('skips non-Edit/Write tools', () => {
    expect(requiredSkills({
      tool_name: 'Read', tool_input: { file_path: '/foo/bar.py' }, transcript_path: '',
    })).toEqual([]);
  });

  it('skips unknown extensions', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/foo/bar.json' }, transcript_path: '',
    })).toEqual([]);
  });

  it('skips files without extension', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/foo/Makefile' }, transcript_path: '',
    })).toEqual([]);
  });
});

// -- sessionStartContext ------------------------------------------------------

describe('sessionStartContext', () => {
  it('names every required skill so the hint covers all rules', () => {
    const ctx = sessionStartContext();
    expect(ctx).toContain('how-to-document');
    expect(ctx).toContain('how-to-comment');
  });

  it('directs loading through the Skill tool, not Read', () => {
    expect(sessionStartContext()).toContain('Skill tool');
  });
});

// -- loadedSkills -------------------------------------------------------------

describe('loadedSkills', () => {
  it('extracts skill names from Skill tool_use entries', () => {
    const p = writeTranscript([
      { type: 'user', message: { content: 'do something' } },
      skillEntry('basic-engineering:how-to-comment'),
    ]);
    const loaded = loadedSkills(p);
    expect(loaded.has('how-to-comment')).toBe(true);
    expect(loaded.has('basic-engineering:how-to-comment')).toBe(true);
  });

  it('handles bare skill names without plugin prefix', () => {
    const p = writeTranscript([skillEntry('how-to-document')]);
    const loaded = loadedSkills(p);
    expect(loaded.has('how-to-document')).toBe(true);
  });

  it('ignores non-Skill tool_use entries', () => {
    const p = writeTranscript([{
      type: 'assistant',
      message: {
        content: [{
          type: 'tool_use', name: 'Edit',
          input: { file_path: '/foo.md' },
        }],
      },
    }]);
    expect(loadedSkills(p).size).toBe(0);
  });

  it('ignores user entries', () => {
    const p = writeTranscript([{
      type: 'user',
      message: { content: 'load how-to-comment' },
    }]);
    expect(loadedSkills(p).size).toBe(0);
  });

  it('handles empty transcript', () => {
    const p = writeTranscript([]);
    expect(loadedSkills(p).size).toBe(0);
  });

  it('skips unparseable lines', () => {
    const p = path.join(tmpDir, 'transcript.jsonl');
    fs.writeFileSync(p, 'not json\n' + JSON.stringify(skillEntry('how-to-comment')) + '\n');
    expect(loadedSkills(p).has('how-to-comment')).toBe(true);
  });
});

// -- missingSkills ------------------------------------------------------------

describe('missingSkills', () => {
  it('reports missing single-skill groups', () => {
    expect(missingSkills(
      [['how-to-comment']],
      new Set<string>(),
    )).toEqual(['how-to-comment']);
  });

  it('reports nothing when skill is loaded', () => {
    expect(missingSkills(
      [['how-to-comment']],
      new Set(['how-to-comment']),
    )).toEqual([]);
  });

  it('formats multi-option groups with or', () => {
    expect(missingSkills(
      [['skill-a', 'skill-b']],
      new Set<string>(),
    )).toEqual(['skill-a or skill-b']);
  });

  it('satisfies group when any option is loaded', () => {
    expect(missingSkills(
      [['skill-a', 'skill-b']],
      new Set(['skill-b']),
    )).toEqual([]);
  });

  it('reports multiple missing groups independently', () => {
    expect(missingSkills(
      [['skill-a'], ['skill-b']],
      new Set<string>(),
    )).toEqual(['skill-a', 'skill-b']);
  });
});

// -- integration --------------------------------------------------------------

describe('integration', () => {
  it('blocks Edit .py when how-to-comment not loaded', () => {
    const p = writeTranscript([
      { type: 'user', message: { content: 'fix the bug' } },
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'I will fix it.' }] },
      },
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/main.py' }, transcript_path: p,
    });
    const missing = missingSkills(required, loadedSkills(p));
    expect(missing).toEqual(['how-to-comment']);
  });

  it('allows Edit .py when how-to-comment is loaded', () => {
    const p = writeTranscript([
      { type: 'user', message: { content: 'fix the bug' } },
      skillEntry('basic-engineering:how-to-comment'),
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/main.py' }, transcript_path: p,
    });
    const missing = missingSkills(required, loadedSkills(p));
    expect(missing).toEqual([]);
  });

  it('blocks Edit .md when how-to-document not loaded', () => {
    const p = writeTranscript([
      skillEntry('how-to-comment'),
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/docs/guide.md' }, transcript_path: p,
    });
    const missing = missingSkills(required, loadedSkills(p));
    expect(missing).toEqual(['how-to-document']);
  });
});
