"""Explicit embedding boundaries, with redacted input and transport failures."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_error_response
from models.library_semantic import IndexRequest, RemoveIndexRequest, SemanticSearchRequest
from services.library_semantic.service import LibrarySemanticService
from services.library_semantic.source import SemanticError
from services.library_semantic.vectors import create_vectors
from services.library_answers.context import capture_search
from workspace import get_workspace_id

router = APIRouter(tags=["library-semantic"])
logger = logging.getLogger(__name__)


async def service():
    documents = get_document_service()
    vectors = await create_vectors(documents)
    try:
        yield LibrarySemanticService(documents, vectors)
    finally:
        await vectors.close()


async def respond(operation):
    try:
        return APIResponse(success=True, data=await operation)
    except SemanticError as error:
        return JSONResponse(status_code=error.status, content=create_error_response(error.code, error.message).model_dump())
    except Exception as error:
        logger.warning("Library semantic operation failed: %s", type(error).__name__)
        return JSONResponse(status_code=503, content=create_error_response(
            "SEMANTIC_UNAVAILABLE", "Semantic search or indexing is unavailable. Refresh status before starting another paid request; no automatic retry was made.").model_dump())


async def body(request, model):
    try:
        return model.model_validate(await request.json())
    except (ValidationError, ValueError, TypeError):
        raise SemanticError("INVALID_SEMANTIC_REQUEST", "The request is invalid. Reload and confirm the intended action.", 422) from None


@router.get("/library/semantic/status")
async def status(workspace=Depends(get_workspace_id), engine=Depends(service)):
    return await respond(engine.status(workspace))


@router.post("/library/semantic/documents/{document_id}/plan")
async def plan(document_id: str, workspace=Depends(get_workspace_id), engine=Depends(service)):
    return await respond(engine.plan(workspace, document_id))


@router.post("/library/semantic/documents/{document_id}/index")
async def index(document_id: str, request: Request, workspace=Depends(get_workspace_id), engine=Depends(service)):
    async def operation():
        return await engine.index(workspace, document_id, await body(request, IndexRequest))
    return await respond(operation())


@router.post("/library/semantic/documents/{document_id}/remove")
async def remove(document_id: str, request: Request, workspace=Depends(get_workspace_id), engine=Depends(service)):
    async def operation():
        return await engine.remove(workspace, document_id, (await body(request, RemoveIndexRequest)).expected_generation)
    return await respond(operation())


@router.post("/library/semantic/search")
async def search(request: Request, workspace=Depends(get_workspace_id), engine=Depends(service)):
    async def operation():
        submitted = await body(request, SemanticSearchRequest)
        result = await engine.search(workspace, submitted)
        result["answer_context_id"] = await capture_search(engine.documents, workspace, submitted.query, "semantic", result)
        return result
    return await respond(operation())
