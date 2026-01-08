"""vie-explainer HTTP server - wraps MCP tools as REST endpoints."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.tools.explain_auto import explain_auto
from src.tools.explain_chat import explain_chat
from src.config import settings

app = FastAPI(
    title="vie-explainer",
    description="Video content explanation service",
    version="1.0.0",
)


class ExplainAutoRequest(BaseModel):
    """Request body for explain_auto endpoint."""
    videoSummaryId: str
    targetType: str  # "section" or "concept"
    targetId: str


class ExplainChatRequest(BaseModel):
    """Request body for explain_chat endpoint."""
    memorizedItemId: str
    userId: str
    message: str
    chatId: Optional[str] = None


class ExplainAutoResponse(BaseModel):
    """Response for explain_auto endpoint."""
    expansion: str


class ExplainChatResponse(BaseModel):
    """Response for explain_chat endpoint."""
    response: str
    chatId: str


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "vie-explainer",
        "model": settings.ANTHROPIC_MODEL,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "vie-explainer",
        "version": "1.0.0",
        "endpoints": [
            "/health",
            "/explain/auto",
            "/explain/chat",
        ],
    }


@app.post("/explain/auto", response_model=ExplainAutoResponse)
async def explain_auto_endpoint(request: ExplainAutoRequest):
    """
    Generate detailed documentation for a video section or concept.
    Results are cached in MongoDB and reused across all users.
    """
    try:
        if request.targetType not in ["section", "concept"]:
            raise HTTPException(
                status_code=400,
                detail="targetType must be 'section' or 'concept'",
            )

        expansion = await explain_auto(
            video_summary_id=request.videoSummaryId,
            target_type=request.targetType,
            target_id=request.targetId,
        )

        return ExplainAutoResponse(expansion=expansion)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/explain/chat", response_model=ExplainChatResponse)
async def explain_chat_endpoint(request: ExplainChatRequest):
    """
    Interactive conversation about a memorized item.
    Personalized per user, chat history maintained in MongoDB.
    """
    try:
        result = await explain_chat(
            memorized_item_id=request.memorizedItemId,
            user_id=request.userId,
            message=request.message,
            chat_id=request.chatId,
        )

        return ExplainChatResponse(
            response=result["response"],
            chatId=result["chatId"],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
