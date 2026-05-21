# my-claude-code-plugins

ryangowe's personal [Claude Code](https://code.claude.com/docs) plugin marketplace.

## Use it

Add the marketplace (once it's hosted on GitHub), then install a plugin from it:

```
/plugin marketplace add ryangowe/my-claude-code-plugin
/plugin install hello-world@my-claude-code-plugins
```

## Add a plugin

Each plugin is a directory under `plugins/`. Copy `plugins/hello-world/` as a
starting point, then register it in `.claude-plugin/marketplace.json`.

The `plugin.json` / `marketplace.json` schemas and the plugin component layout
live in the Claude Code docs:

- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Create and distribute a marketplace](https://code.claude.com/docs/en/plugin-marketplaces)

## Development

Install the git hooks once after cloning:

```
pre-commit install
```

They format and validate JSON/YAML on each commit; `pre-commit run --all-files`
runs them manually.
