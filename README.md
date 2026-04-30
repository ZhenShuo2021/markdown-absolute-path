# Markdown Absolute Path

Resolves absolute paths in Markdown against configurable root directories, adding what VS Code and Markdown All in One lack.

## What this adds

**Multiple roots.** Real projects need more than one root, `content/` for Markdown, `static/` for images, `public/` for assets. Markdown All in One only supports a single root, this extension supports as many as you need.

**Follow link.** Click any absolute link, including image links, angle-bracket links, and all reference link variants to open the target file.

**Live Hover Preview.** Hover over any resolved absolute path to see what's inside without opening the file.

## Settings

| Setting | Default | Description |
|---|---|---|
| `markdownAbsPath.rootDirs` | `[]` | Workspace-relative roots to search, e.g. `["content", "static", "public"]` |
| `markdownAbsPath.hover.enable` | `false` | Enables path correction for link hover previews. Note: Due to VS Code API limitations, the built-in error preview and broken link will still persist. Enabling this implies acceptance of this behavior. |

## License

MIT
