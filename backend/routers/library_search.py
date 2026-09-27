"""Local, read-only Library passage search. No indexing or AI dispatch."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_error_response
from models.library_search import LibrarySearchRequest, LibrarySearchResponse
from services.library_search import LibrarySearchService
from services.library_answers.context import capture_search
from workspace import get_workspace_id


router = APIRouter(tags=["library-search"])
logger = logging.getLogger(__name__)


@router.post(
    "/library/search",
    response_model=APIResponse[LibrarySearchResponse],
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {"schema": LibrarySearchRequest.model_json_schema()}
            },
            "required": True,
        }
    },
)
async def search_library(
    request: Request,
    workspace_id: str = Depends(get_workspace_id),
) -> APIResponse[LibrarySearchResponse] | JSONResponse:
    """Search current source passages without logging the query or calling AI."""
    try:
        body = LibrarySearchRequest.model_validate(await request.json())
    except (ValidationError, ValueError, TypeError):
        # FastAPI's default validation response echoes the submitted query.
        return JSONResponse(
            status_code=422,
            content=create_error_response(
                "INVALID_SEARCH_QUERY",
                "Enter a search of 2–200 characters and try again.",
            ).model_dump(),
        )
    try:
        results = await LibrarySearchService(get_document_service()).search(
            workspace_id,
            body.query,
            body.limit,
        )
        results.answer_context_id = await capture_search(
            get_document_service(), workspace_id, body.query, "keyword", results.model_dump())
        return APIResponse(success=True, data=results)
    except Exception as error:
        logger.error("Library search failed: %s", type(error).__name__)
        return JSONResponse(
            status_code=503,
            content=create_error_response(
                "LIBRARY_SEARCH_UNAVAILABLE",
                "Agreement text search is unavailable. No data was changed.",
            ).model_dump(),
        )
