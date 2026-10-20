# Hosts

The skills are the seven `skills/frameforge-*/` folders in the repository. As a plugin they install with the repository (`docs/plugin.md`); as plain skills, link each folder where your agent looks:

| Agent | Personal | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/frameforge-*` | `.claude/skills/frameforge-*` |
| Codex | `~/.codex/skills/frameforge-*` | `.agents/skills/frameforge-*` |
| Cursor | `~/.cursor/skills/frameforge-*` | `.cursor/skills/frameforge-*` |
| Grok Build | `~/.grok/skills/frameforge-*` | `.grok/skills/frameforge-*` |

`npm run skill:install` symlinks every `frameforge-*` folder into each personal location that exists and skips the rest. Model guidance: a weak model (haiku, gpt-*-luna, grok build-fast) must stay inside the kit and the template; a strong model may draw `assets.tsx` and do cross review. If the host offers an image or vector generation tool, set `FRAMEFORGE_IMAGE_COMMAND` (template with `{prompt}`; must print a PNG path or JSON `{paths: [...]}`) so the asset resolver can use it.
