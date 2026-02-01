# Backend Python Refactor - Context

Technical context, key files, and architectural decisions for the refactor.

**Last Updated**: 2026-02-01

---

## Key Files

### Summarizer Service

| File | Lines | Purpose | Issue |
|------|-------|---------|-------|
| `routes/stream.py` | 928 | SSE streaming endpoint | Too large, mixed concerns |
| `services/summarizer_service.py` | ~200 | LLM summarization | Good pattern |
| `repositories/base.py` | ~50 | Repository protocol | Good pattern |
| `dependencies.py` | ~100 | DI providers | Uses Depends() |
| `main.py` | ~150 | App factory | Some inline logic |

### Explainer Service

| File | Lines | Purpose | Issue |
|------|-------|---------|-------|
| `services/mongodb.py` | 224 | Database access | Blocking PyMongo |
| `main.py` | 191 | Routes + schemas | Mixed concerns |
| `tools/explain_auto.py` | ~150 | Auto explain tool | Uses globals |
| `tools/explain_chat.py` | ~100 | Chat tool | Uses globals |
| `services/llm.py` | ~150 | LLM service | Singleton pattern |

---

## Architecture Patterns

### Current: Summarizer (Good Example)

```python
# dependencies.py - Proper DI
from typing import Annotated
from fastapi import Depends

async def get_video_repository() -> VideoRepository:
    return MongoDBVideoRepository(get_db())

VideoRepositoryDep = Annotated[VideoRepository, Depends(get_video_repository)]

# routes/stream.py - Uses DI
@router.post("/summarize/stream")
async def stream_summary(
    request: SummarizeRequest,
    repo: VideoRepositoryDep,
):
    # ... uses injected repo
```

### Current: Explainer (Anti-Pattern)

```python
# services/mongodb.py - Global singleton
_client: MongoClient | None = None

def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client

# tools/explain_auto.py - Hidden dependency
def explain_auto(video_summary_id: str) -> str:
    summary = get_video_summary(video_summary_id)  # Hidden!
    # Can't mock for testing
```

### Target: Explainer (Fixed)

```python
# dependencies.py - NEW
from typing import Annotated
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient

async def get_mongo_client() -> AsyncIOMotorClient:
    return AsyncIOMotorClient(settings.mongodb_uri)

async def get_video_summary_repo(
    client: Annotated[AsyncIOMotorClient, Depends(get_mongo_client)]
) -> VideoSummaryRepository:
    return VideoSummaryRepository(client.get_database())

VideoSummaryRepoDep = Annotated[VideoSummaryRepository, Depends(get_video_summary_repo)]

# main.py - Routes with DI
@app.post("/tools/explain-auto")
async def explain_auto(
    request: ExplainAutoRequest,
    repo: VideoSummaryRepoDep,
    llm: LLMServiceDep,
):
    return await explain_auto_tool(request, repo, llm)
```

---

## MongoDB Migration: PyMongo → Motor

### Before (Blocking)

```python
# services/mongodb.py
from pymongo import MongoClient

def get_video_summary(video_summary_id: str) -> dict | None:
    collection = get_collection()
    return collection.find_one({"_id": ObjectId(video_summary_id)})
```

### After (Async)

```python
# repositories/mongodb_repository.py
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

class VideoSummaryRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection("video_summaries")

    async def find_by_id(self, video_summary_id: str) -> VideoSummary | None:
        doc = await self._collection.find_one({"_id": ObjectId(video_summary_id)})
        return self._to_entity(doc) if doc else None

    def _to_entity(self, doc: dict) -> VideoSummary:
        return VideoSummary(**doc)
```

---

## Stream.py Extraction Plan

### Current Structure (928 lines)

```
routes/stream.py
├── Imports & constants (~50 lines)
├── Helper functions (~200 lines)
│   ├── extract_context()
│   ├── analyze_description()
│   ├── build_prompt()
│   └── format_response()
├── Pipeline orchestration (~400 lines)
│   ├── fetch_transcript()
│   ├── process_sections()
│   ├── run_parallel_analysis()
│   └── stream_synthesis()
├── SSE streaming (~150 lines)
│   ├── StreamingResponse setup
│   └── Event formatting
└── Route handler (~100 lines)
    └── POST /summarize/stream
```

### Target Structure

```
services/pipeline.py (~400 lines)
├── SummarizationPipeline class
│   ├── __init__(deps)
│   ├── async execute(request)
│   ├── async _fetch_transcript()
│   ├── async _extract_context()
│   ├── async _process_sections()
│   └── async _stream_synthesis()

routes/stream.py (~150 lines)
├── Imports
├── Route handler
│   ├── Parse request
│   ├── Call pipeline.execute()
│   └── Return StreamingResponse
└── SSE event formatting
```

---

## Schemas to Extract (Explainer)

### Currently in main.py

```python
# main.py - Mixed with routes
class ExplainAutoRequest(BaseModel):
    video_summary_id: str
    sections: list[str] | None = None

class ExplainChatRequest(BaseModel):
    video_summary_id: str
    message: str
    history: list[dict] | None = None
```

### Target: schemas.py

```python
# schemas.py - Dedicated file
from pydantic import BaseModel, Field

class ExplainAutoRequest(BaseModel):
    """Request for automatic explanation generation."""
    video_summary_id: str = Field(..., description="MongoDB ObjectId")
    sections: list[str] | None = Field(None, description="Specific sections")

class ExplainAutoResponse(BaseModel):
    """Response from auto-explain."""
    explanation: str
    sections_explained: list[str]
    usage: dict | None = None

class ExplainChatRequest(BaseModel):
    """Request for chat-based explanation."""
    video_summary_id: str
    message: str
    history: list[ChatMessage] | None = None

class ChatMessage(BaseModel):
    """Single chat message."""
    role: str  # "user" | "assistant"
    content: str
```

---

## Configuration Pattern

### Current (Explainer)

```python
# config.py
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "vie")
```

### Target (Pydantic Settings)

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    database_name: str = "vie"
    llm_model: str = "anthropic/claude-sonnet-4-20250514"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Testing Strategy

### Unit Test Example (With DI)

```python
# tests/test_explain_auto.py
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=VideoSummaryRepository)
    repo.find_by_id.return_value = VideoSummary(
        id="123",
        title="Test Video",
        sections=[...]
    )
    return repo

@pytest.fixture
def mock_llm():
    llm = AsyncMock(spec=LLMService)
    llm.generate.return_value = "Explanation text"
    return llm

async def test_explain_auto_returns_explanation(mock_repo, mock_llm):
    result = await explain_auto_tool(
        request=ExplainAutoRequest(video_summary_id="123"),
        repo=mock_repo,
        llm=mock_llm,
    )
    assert result.explanation == "Explanation text"
    mock_repo.find_by_id.assert_called_once_with("123")
```

---

## Dependencies

### Explainer Requirements

```
# requirements.txt additions
motor>=3.3.0           # Async MongoDB driver
structlog>=24.0.0      # Structured logging (Phase 5)
```

### Motor vs PyMongo API Differences

| Operation | PyMongo | Motor |
|-----------|---------|-------|
| Find one | `collection.find_one()` | `await collection.find_one()` |
| Find many | `list(collection.find())` | `await collection.find().to_list()` |
| Insert | `collection.insert_one()` | `await collection.insert_one()` |
| Update | `collection.update_one()` | `await collection.update_one()` |
| Delete | `collection.delete_one()` | `await collection.delete_one()` |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Async driver | Motor | Official MongoDB async driver for Python |
| DI pattern | FastAPI Depends() | Framework standard, testable |
| Repository abstraction | Protocol classes | Allows alternative implementations |
| Schema location | Separate file | Follows backend-python skill |
| Logging | structlog | Structured JSON, context binding |

---

## Integration Points

### Explainer → vie-api

```
vie-api calls explainer endpoints:
POST /tools/explain-auto
POST /tools/explain-chat
POST /tools/explain-chat/stream (SSE)

No API changes - internal refactor only
```

### Summarizer → vie-api

```
vie-api calls summarizer endpoints:
POST /summarize/stream (SSE)
POST /playlist/extract

No API changes - internal refactor only
```

---

## Rollback Plan

1. **Git tags before each phase**: `git tag pre-phase-1`
2. **Feature flags not needed**: Internal refactor, no behavior change
3. **Incremental changes**: Each phase independently deployable
4. **Test verification**: All tests must pass before merge
