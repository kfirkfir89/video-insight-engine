# vie-summarizer

Python worker for YouTube video summarization.

## Before You Code

1. **Read the skill:** [.claude/skills/python-services/SKILL.md](../.claude/skills/python-services/SKILL.md)
2. **Read the spec:** [docs/SERVICE-SUMMARIZER.md](../docs/SERVICE-SUMMARIZER.md)
3. **Error handling:** [docs/ERROR-HANDLING.md](../docs/ERROR-HANDLING.md) - Video edge cases, retry, DLQ

## Quick Reference

```
summarizer/
├── src/
│   ├── __init__.py
│   ├── main.py           # FastAPI health
│   ├── worker.py         # RabbitMQ consumer
│   ├── config.py         # Settings
│   ├── services/
│   │   ├── transcript.py
│   │   ├── cleaner.py
│   │   ├── summarizer.py
│   │   └── mongodb.py
│   ├── prompts/          # LLM prompts
│   └── models/           # Pydantic
├── Dockerfile
└── requirements.txt
```

## Key Patterns

- Pydantic for all data models
- pydantic-settings for config
- Never crash the worker
- Log everything

## Pipeline

1. Fetch transcript (youtube-transcript-api)
2. Clean text
3. Detect sections (LLM)
4. Summarize sections (LLM)
5. Extract concepts (LLM)
6. Synthesize (LLM)
7. Save to cache

## Commands

```bash
python -m src.worker     # Run worker
uvicorn src.main:app     # Health endpoint
pytest                   # Tests
```
