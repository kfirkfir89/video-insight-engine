# vie-explainer

Python MCP server with explain tools.

## Before You Code

1. **Read the skill:** [.claude/skills/mcp-development/SKILL.md](../.claude/skills/mcp-development/SKILL.md)
2. **Read the spec:** [docs/SERVICE-EXPLAINER.md](../docs/SERVICE-EXPLAINER.md)
3. **Read MCP API:** [docs/API-MCP-EXPLAINER.md](../docs/API-MCP-EXPLAINER.md)

## Quick Reference

```
explainer/
├── src/
│   ├── __init__.py
│   ├── server.py         # MCP entry
│   ├── config.py
│   ├── tools/
│   │   ├── explain_auto.py   # Cached
│   │   └── explain_chat.py   # Not cached
│   ├── services/
│   │   ├── llm.py
│   │   ├── cache.py
│   │   └── mongodb.py
│   └── prompts/
├── Dockerfile
└── requirements.txt
```

## MCP Tools

| Tool           | Cached | Purpose                  |
| -------------- | ------ | ------------------------ |
| `explain_auto` | ✅ Yes | Generate documentation   |
| `explain_chat` | ❌ No  | Interactive conversation |

## Key Patterns

- Cache explain_auto results
- Never cache explain_chat
- Return JSON strings for complex data
- Good tool descriptions for Claude

## Commands

```bash
python -m src.server     # Run MCP server
mcp dev src/server.py    # Dev with inspector
pytest                   # Tests
```
