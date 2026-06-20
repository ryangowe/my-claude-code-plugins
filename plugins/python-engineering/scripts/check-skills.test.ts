import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { requiredSkills, loadedSkills, missingSkills } from './check-skills.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-skills-python-'));
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
  it('requires how-to-write-pythonic-code for Edit .py', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/app.py' }, transcript_path: '',
    })).toEqual([['how-to-write-pythonic-code']]);
  });

  it('requires structure skills for Write .py', () => {
    expect(requiredSkills({
      tool_name: 'Write', tool_input: { file_path: '/src/new_module.py' }, transcript_path: '',
    })).toEqual([['how-to-structure-python-modules', 'how-to-structure-python-projects']]);
  });

  it('requires both pythonic-code and python-tests for Edit test_*.py', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/tests/test_parser.py' }, transcript_path: '',
    })).toEqual([['how-to-write-pythonic-code'], ['how-to-write-python-tests']]);
  });

  it('requires both pythonic-code and python-tests for Edit *_test.py', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/parser_test.py' }, transcript_path: '',
    })).toEqual([['how-to-write-pythonic-code'], ['how-to-write-python-tests']]);
  });

  it('skips non-.py files', () => {
    expect(requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/app.ts' }, transcript_path: '',
    })).toEqual([]);
  });

  it('skips non-Edit/Write tools', () => {
    expect(requiredSkills({
      tool_name: 'Read', tool_input: { file_path: '/src/app.py' }, transcript_path: '',
    })).toEqual([]);
  });

  it('does not flag test skills for Write test_*.py', () => {
    expect(requiredSkills({
      tool_name: 'Write', tool_input: { file_path: '/tests/test_new.py' }, transcript_path: '',
    })).toEqual([['how-to-structure-python-modules', 'how-to-structure-python-projects']]);
  });
});

// -- loadedSkills -------------------------------------------------------------

describe('loadedSkills', () => {
  it('extracts prefixed skill names', () => {
    const p = writeTranscript([
      skillEntry('python-engineering:how-to-write-pythonic-code'),
    ]);
    const loaded = loadedSkills(p);
    expect(loaded.has('how-to-write-pythonic-code')).toBe(true);
    expect(loaded.has('python-engineering:how-to-write-pythonic-code')).toBe(true);
  });

  it('handles bare skill names', () => {
    const p = writeTranscript([skillEntry('how-to-write-python-tests')]);
    expect(loadedSkills(p).has('how-to-write-python-tests')).toBe(true);
  });

  it('collects multiple skills', () => {
    const p = writeTranscript([
      skillEntry('how-to-write-pythonic-code'),
      skillEntry('how-to-write-python-tests'),
    ]);
    const loaded = loadedSkills(p);
    expect(loaded.has('how-to-write-pythonic-code')).toBe(true);
    expect(loaded.has('how-to-write-python-tests')).toBe(true);
  });

  it('ignores non-assistant entries', () => {
    const p = writeTranscript([{
      type: 'user',
      message: { content: 'load how-to-write-pythonic-code' },
    }]);
    expect(loadedSkills(p).size).toBe(0);
  });

  it('skips unparseable lines', () => {
    const p = path.join(tmpDir, 'transcript.jsonl');
    fs.writeFileSync(p, 'garbage\n' + JSON.stringify(skillEntry('how-to-write-pythonic-code')) + '\n');
    expect(loadedSkills(p).has('how-to-write-pythonic-code')).toBe(true);
  });
});

// -- missingSkills ------------------------------------------------------------

describe('missingSkills', () => {
  it('reports all missing groups', () => {
    expect(missingSkills(
      [['how-to-write-pythonic-code'], ['how-to-write-python-tests']],
      new Set<string>(),
    )).toEqual(['how-to-write-pythonic-code', 'how-to-write-python-tests']);
  });

  it('reports only the unsatisfied group', () => {
    expect(missingSkills(
      [['how-to-write-pythonic-code'], ['how-to-write-python-tests']],
      new Set(['how-to-write-pythonic-code']),
    )).toEqual(['how-to-write-python-tests']);
  });

  it('satisfies or-group when any option is loaded', () => {
    expect(missingSkills(
      [['how-to-structure-python-modules', 'how-to-structure-python-projects']],
      new Set(['how-to-structure-python-projects']),
    )).toEqual([]);
  });

  it('formats or-group in message', () => {
    expect(missingSkills(
      [['how-to-structure-python-modules', 'how-to-structure-python-projects']],
      new Set<string>(),
    )).toEqual(['how-to-structure-python-modules or how-to-structure-python-projects']);
  });
});

// -- integration --------------------------------------------------------------

describe('integration', () => {
  it('blocks Edit .py when no skill loaded', () => {
    const p = writeTranscript([
      { type: 'user', message: { content: 'fix the parser' } },
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/parser.py' }, transcript_path: p,
    });
    expect(missingSkills(required, loadedSkills(p))).toEqual(['how-to-write-pythonic-code']);
  });

  it('allows Edit .py when pythonic-code loaded', () => {
    const p = writeTranscript([
      skillEntry('python-engineering:how-to-write-pythonic-code'),
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/src/parser.py' }, transcript_path: p,
    });
    expect(missingSkills(required, loadedSkills(p))).toEqual([]);
  });

  it('blocks Edit test file when only pythonic-code loaded', () => {
    const p = writeTranscript([
      skillEntry('how-to-write-pythonic-code'),
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/tests/test_parser.py' }, transcript_path: p,
    });
    expect(missingSkills(required, loadedSkills(p))).toEqual(['how-to-write-python-tests']);
  });

  it('allows Edit test file when both skills loaded', () => {
    const p = writeTranscript([
      skillEntry('how-to-write-pythonic-code'),
      skillEntry('how-to-write-python-tests'),
    ]);
    const required = requiredSkills({
      tool_name: 'Edit', tool_input: { file_path: '/tests/test_parser.py' }, transcript_path: p,
    });
    expect(missingSkills(required, loadedSkills(p))).toEqual([]);
  });

  it('allows Write .py when structure skill loaded', () => {
    const p = writeTranscript([
      skillEntry('how-to-structure-python-modules'),
    ]);
    const required = requiredSkills({
      tool_name: 'Write', tool_input: { file_path: '/src/new.py' }, transcript_path: p,
    });
    expect(missingSkills(required, loadedSkills(p))).toEqual([]);
  });
});
