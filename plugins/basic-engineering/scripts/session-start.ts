import { fileURLToPath } from 'node:url';
import { sessionStartContext } from './check-skills.js';

function main(): void {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: sessionStartContext(),
    },
  };
  console.log(JSON.stringify(output));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
