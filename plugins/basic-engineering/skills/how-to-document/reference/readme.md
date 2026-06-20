# README skeleton

<!-- Reader: someone who just cloned the repo and opened the first file. -->

<!-- They want three answers: what is this, how do I run it, how do I contribute. -->

<!-- Everything else is noise at this stage — link out to docs/ for depth. -->

# Project Name

One sentence: what it does and why you'd pick it over alternatives.

## Quick start

```bash
# Prerequisites: Node 20+, pnpm
pnpm install
pnpm dev
```

## Usage

```ts
import { createPipeline } from "project-name";

const pipeline = createPipeline({ retries: 3 });
await pipeline.run(tasks);
```

<!-- One minimal, runnable example. Not a tutorial — just proof it works. -->

## Documentation

- [Guide](docs/guide.md) — step-by-step walkthrough
- [API Reference](docs/api.md) — full interface docs
- [Design Decisions](docs/adr/) — why things are the way they are

<!-- Link, don't inline. The README stays short; detail lives elsewhere. -->

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
