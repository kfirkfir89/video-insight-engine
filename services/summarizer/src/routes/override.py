"""Override endpoint for changing detected category during pipeline processing.

HTTP layer only — state management lives in services/override_state.py.
"""

import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from src.config import settings
from src.services.output_type import determine_output_type, get_output_type_label
from src.services.override_state import set_override
from src.services.video.youtube import VALID_CATEGORIES, select_persona

logger = logging.getLogger(__name__)

router = APIRouter(tags=["override"])


class OverrideRequest(BaseModel):
    """Request body for category override."""
    category: str


class OverrideResponse(BaseModel):
    """Response from category override."""
    category: str
    outputType: str
    outputTypeLabel: str
    persona: str


@router.post("/override/{video_summary_id}", response_model=OverrideResponse)
async def override_category(
    video_summary_id: str,
    request: OverrideRequest,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
) -> OverrideResponse:
    """Override detected category for an active pipeline.

    Must be called before intent detection runs — the override provides
    a category hint that influences output type selection.

    Requires X-Internal-Secret header matching INTERNAL_SECRET config.
    """
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing internal secret")

    category = request.category.lower().strip()

    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category '{request.category}'. Valid: {sorted(VALID_CATEGORIES)}",
        )

    persona = select_persona(category)
    output_type = determine_output_type(category)

    set_override(video_summary_id, {
        "category": category,
        "persona": persona,
        "output_type": output_type,
    })

    return OverrideResponse(
        category=category,
        outputType=output_type,
        outputTypeLabel=get_output_type_label(output_type),
        persona=persona,
    )
