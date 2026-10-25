// Desktop extension entry: starts the MCP server of the Frameforge checkout named by FRAMEFORGE_ENGINE.
// The engine (its node_modules, Chrome, ffmpeg, Python) cannot ship inside the bundle, so the bundle only points at it.
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const engine = resolve(process.env.FRAMEFORGE_ENGINE || '');
const server = join(engine, 'mcp/server.mjs');
if (!process.env.FRAMEFORGE_ENGINE || !existsSync(server)) {
  console.error(`Frameforge engine folder not found (${engine}). Set "Frameforge engine folder" to a clone of https://github.com/jonsoku-dev/frameforge after npm ci.`);
  process.exit(1);
}
if (!existsSync(join(engine, 'node_modules/@modelcontextprotocol/sdk'))) {
  console.error(`Run npm ci in ${engine} first.`);
  process.exit(1);
}
await (await import(pathToFileURL(server).href)).serve([]);
