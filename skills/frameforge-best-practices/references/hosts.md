# Hosts

The skills are the seven `skills/frameforge-*/` folders in the repository. As a plugin they install with the repository (`docs/plugin.md`); as plain skills, link each folder where your agent looks:

| Agent | Personal | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/frameforge-*` | `.claude/skills/frameforge-*` |
| Codex | `~/.codex/skills/frameforge-*` | `.agents/skills/frameforge-*` |
| Cursor | `~/.cursor/skills/frameforge-*` | `.cursor/skills/frameforge-*` |
| Grok Build | `~/.grok/skills/frameforge-*` | `.grok/skills/frameforge-*` |

`npm run skill:install` symlinks every `frameforge-*` folder into each personal location that exists and skips the rest. Install only when requested. Respect the user's production-model preference using models actually exposed by the host: direction, assets, animation implementation and revision all need creative judgment. Do not restrict a model to a kit based on an assumed tier. Record the requested model setting separately from a runtime identity that the host does not expose. If an authorized image/vector command is already available, `FRAMEFORGE_IMAGE_COMMAND` accepts a template with `{prompt}` that prints a PNG path or JSON `{paths: [...]}`; its availability does not authorize a new paid service.
