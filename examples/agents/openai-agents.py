"""Make a Frameforge film with the OpenAI Agents SDK driving the local Frameforge MCP server over stdio.

    pip install openai-agents
    export OPENAI_API_KEY=...            # your own key, read from the environment only
    python3 examples/agents/openai-agents.py ~/my-films "12초 제품 런칭 모션그래픽, 마지막에 이름"

The engine stays local and keyless; only the agent's model calls go to OpenAI.
"""
import asyncio
import os
import sys
from pathlib import Path

from agents import Agent, Runner
from agents.mcp import MCPServerStdio

ENGINE = Path(__file__).resolve().parents[2]


async def main(project: str, request: str) -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit("Set OPENAI_API_KEY in the environment.")
    project = str(Path(project).expanduser().resolve())
    params = {"command": "node", "args": [str(ENGINE / "bin/frameforge.mjs"), "mcp", "--project", project]}
    # Renders take minutes; the default MCP read timeout is a few seconds.
    async with MCPServerStdio(name="frameforge", params=params, client_session_timeout_seconds=1800, cache_tools_list=True) as server:
        motion = any(word in request.lower() for word in ("motion", "모션", "ident", "아이덴트", "launch", "런칭", "promo", "showreel", "reel"))
        prompt = await server.get_prompt("make_motion_film" if motion else "make_explainer", {"request": request})
        instructions = "\n\n".join(message.content.text for message in prompt.messages)
        if not (Path(project) / "frameforge.json").exists():
            instructions += f"\n\nFirst call project_init with dir {project}."
        agent = Agent(name="Frameforge maker", instructions=instructions, mcp_servers=[server])
        result = await Runner.run(agent, request, max_turns=120)
        print(result.final_output)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1], " ".join(sys.argv[2:])))
