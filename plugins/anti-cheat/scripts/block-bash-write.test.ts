import { describe, it, expect } from 'vitest';
import { hasGuardedFile, hasContentWrite, shouldBlock, stripHeredocs, checkBashWrite } from './block-bash-write.js';

// -- hasGuardedFile -----------------------------------------------------------

describe('hasGuardedFile', () => {
  it('detects .ts', () => expect(hasGuardedFile('cat > vitest.config.ts')).toBe(true));
  it('detects .py', () => expect(hasGuardedFile('echo hello > main.py')).toBe(true));
  it('detects .md', () => expect(hasGuardedFile('tee README.md')).toBe(true));
  it('detects .tsx', () => expect(hasGuardedFile('sed -i s/a/b/ App.tsx')).toBe(true));
  it('detects path with dir', () => expect(hasGuardedFile('cat > src/utils/helper.ts')).toBe(true));
  it('strips trailing quotes', () => expect(hasGuardedFile("cat > 'file.ts'")).toBe(true));
  it('ignores .json', () => expect(hasGuardedFile('cat > package.json')).toBe(false));
  it('ignores .txt', () => expect(hasGuardedFile('echo hi > notes.txt')).toBe(false));
  it('ignores .log', () => expect(hasGuardedFile('cmd > output.log')).toBe(false));
  it('ignores .yaml', () => expect(hasGuardedFile('cat > config.yaml')).toBe(false));
  it('ignores no extension', () => expect(hasGuardedFile('echo hi > Makefile')).toBe(false));
});

// -- hasContentWrite ----------------------------------------------------------

describe('hasContentWrite', () => {
  it('detects >', () => expect(hasContentWrite('cat > file')).toBe(true));
  it('detects >>', () => expect(hasContentWrite('echo hi >> file')).toBe(true));
  it('detects tee', () => expect(hasContentWrite('echo hi | tee file')).toBe(true));
  it('detects sed -i', () => expect(hasContentWrite("sed -i 's/a/b/' file")).toBe(true));
  it('detects perl -i', () => expect(hasContentWrite("perl -pi -e 's/a/b/' file")).toBe(true));
  it('detects sponge', () => expect(hasContentWrite('jq . file | sponge file')).toBe(true));
  it('detects patch', () => expect(hasContentWrite('patch -p1 < diff.patch')).toBe(true));
  it('ignores stderr 2>', () => expect(hasContentWrite('cmd 2> /dev/null')).toBe(false));
  it('ignores &>', () => expect(hasContentWrite('cmd &> /dev/null')).toBe(false));
  it('ignores plain read', () => expect(hasContentWrite('cat file')).toBe(false));
  it('ignores grep', () => expect(hasContentWrite('grep pattern file')).toBe(false));
  it('ignores -> arrow', () => expect(hasContentWrite('spans(splits) -> list[ClipSpan]')).toBe(false));
  it('ignores => arrow', () => expect(hasContentWrite('const f = () => x')).toBe(false));
});

// -- stripHeredocs ------------------------------------------------------------

describe('stripHeredocs', () => {
  it('drops the body, keeps the opening line', () =>
    expect(stripHeredocs("git commit -F - <<'EOF'\nfix records.py: a -> b\nEOF")).toBe(
      "git commit -F - <<'EOF'",
    ));
  it('keeps a redirect on the opening line', () =>
    expect(stripHeredocs("cat > f.ts <<'EOF'\ncode\nEOF")).toBe("cat > f.ts <<'EOF'"));
  it('leaves command without heredoc untouched', () =>
    expect(stripHeredocs('echo hi > out.txt')).toBe('echo hi > out.txt'));
  it('handles unquoted and indented delimiters', () =>
    expect(stripHeredocs('cmd <<-END\nbody\n\tEND\nrest')).toBe('cmd <<-END\nrest'));
});

// -- shouldBlock (integration) ------------------------------------------------

describe('shouldBlock', () => {
  describe('blocks bypasses', () => {
    it('cat heredoc to .ts', () =>
      expect(shouldBlock("cat > vitest.config.ts << 'EOF'\nimport { defineConfig } from 'vitest';\nEOF")).toBe(true));
    it('echo to .py', () =>
      expect(shouldBlock('echo "print(1)" > script.py')).toBe(true));
    it('tee to .md', () =>
      expect(shouldBlock('echo "# Title" | tee README.md')).toBe(true));
    it('sed -i on .ts', () =>
      expect(shouldBlock("sed -i 's/foo/bar/g' src/index.ts")).toBe(true));
    it('printf redirect to .js', () =>
      expect(shouldBlock("printf 'code' > bundle.js")).toBe(true));
    it('append to .py', () =>
      expect(shouldBlock('echo "import os" >> main.py')).toBe(true));
    it('patch on .rs', () =>
      expect(shouldBlock('patch src/lib.rs < fix.patch')).toBe(true));
    it('perl -i on .rb', () =>
      expect(shouldBlock("perl -pi -e 's/old/new/' app.rb")).toBe(true));
  });

  describe('allows legitimate operations', () => {
    it('cat read .ts', () =>
      expect(shouldBlock('cat src/index.ts')).toBe(false));
    it('grep in .py', () =>
      expect(shouldBlock('grep -n "def main" main.py')).toBe(false));
    it('head .md', () =>
      expect(shouldBlock('head -20 README.md')).toBe(false));
    it('redirect to non-code file', () =>
      expect(shouldBlock('echo hello > output.txt')).toBe(false));
    it('redirect to .json', () =>
      expect(shouldBlock('echo "{}" > package.json')).toBe(false));
    it('git status', () =>
      expect(shouldBlock('git status')).toBe(false));
    it('npm install', () =>
      expect(shouldBlock('npm install vitest')).toBe(false));
    it('npx tsx script.ts (no write)', () =>
      expect(shouldBlock('npx tsx script.ts')).toBe(false));
    it('cp file.ts (no content write)', () =>
      expect(shouldBlock('cp src.ts dst.ts')).toBe(false));
    it('mv file.ts (no content write)', () =>
      expect(shouldBlock('mv old.ts new.ts')).toBe(false));
    it('empty', () =>
      expect(shouldBlock('')).toBe(false));
    it('diff two .ts files', () =>
      expect(shouldBlock('diff a.ts b.ts')).toBe(false));
    it('wc on .py', () =>
      expect(shouldBlock('wc -l main.py')).toBe(false));
    it('stderr redirect with .ts arg', () =>
      expect(shouldBlock('npx tsx script.ts 2> /dev/null')).toBe(false));
    it('git commit heredoc mentioning .py and arrows', () =>
      expect(shouldBlock(
        "git commit -F - <<'EOF'\nrefactor: spans(splits) -> list; delete records.py\nEOF",
      )).toBe(false));
    it('git commit -m mentioning .py and an arrow', () =>
      expect(shouldBlock('git commit -m "spans -> list in records.py"')).toBe(false));
  });
});

// -- checkBashWrite -----------------------------------------------------------

describe('checkBashWrite', () => {
  it('blocks Bash tool writing code file', () => {
    const result = checkBashWrite({
      tool_name: 'Bash',
      tool_input: { command: "cat > vitest.config.ts << 'EOF'\ncontent\nEOF" },
    });
    expect(result.blocked).toBe(true);
  });

  it('allows Bash tool reading code file', () => {
    const result = checkBashWrite({
      tool_name: 'Bash',
      tool_input: { command: 'cat src/index.ts' },
    });
    expect(result.blocked).toBe(false);
  });

  it('allows Bash tool writing non-code file', () => {
    const result = checkBashWrite({
      tool_name: 'Bash',
      tool_input: { command: 'echo result > output.txt' },
    });
    expect(result.blocked).toBe(false);
  });

  it('ignores non-Bash tools', () => {
    const result = checkBashWrite({
      tool_name: 'Write',
      tool_input: { command: 'cat > file.ts' },
    });
    expect(result.blocked).toBe(false);
    expect(result.command).toBe('');
  });

  it('handles missing command', () => {
    const result = checkBashWrite({
      tool_name: 'Bash',
      tool_input: {},
    });
    expect(result.blocked).toBe(false);
  });
});
