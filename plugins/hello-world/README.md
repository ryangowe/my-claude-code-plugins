# hello-world

An example plugin for the `my-claude-code-plugins` marketplace. It exercises every
major plugin component so you can copy it as a starting template.

## What's inside

| Path                       | Component     | What it does                                                  |
| -------------------------- | ------------- | ------------------------------------------------------------- |
| `commands/hello.md`        | Slash command | `/hello-world:hello [name]` — greets a person (or the world). |
| `agents/greeter.md`        | Subagent      | `greeter` — drafts warm welcome messages.                     |
| `skills/greeting/SKILL.md` | Skill         | `greeting` — composes context-aware salutations.              |
| `hooks/hooks.json`         | Hook          | Prints `[hello-world] plugin loaded` on session start.        |

## Try it

```
/plugin install hello-world@my-claude-code-plugins
/hello-world:hello Ada
```

## Use it as a template

1. Copy this directory: `cp -r plugins/hello-world plugins/my-plugin`
2. Edit `.claude-plugin/plugin.json` — change `name`, `description`, and `version`.
3. Replace or delete the components you don't need. Each of `commands/`,
   `agents/`, `skills/`, and `hooks/` is optional.
4. Register the plugin in `../../.claude-plugin/marketplace.json`.

> The `hooks/hooks.json` SessionStart hook is only a demo. Delete the file (and the
> `hooks/` directory) if you don't want it.
