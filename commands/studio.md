---
description: Open the Frameforge studio for this project and give its 127.0.0.1 URL (or stop it with "stop")
argument-hint: [port | stop]
---

Argument: $ARGUMENTS

- `stop`: call the `frameforge` MCP tool `studio_stop` and say it stopped.
- Otherwise call `studio_start` (with the port when one is given, default 4317) and give the user the URL it returns. The studio previews every film with sound, shows the production process and can request renders. It keeps running until `studio_stop` or the session ends.
