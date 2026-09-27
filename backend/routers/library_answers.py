"""Local-only, privacy-safe answer preview, explicit dispatch and readback."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_error_response
from models.library_answers import PreviewAnswer, StartAnswer
from services.ai.generation import AIRequestError
from services.library_answers import AnswerError
from services.library_answers.service import LibraryAnswerService
from workspace import get_workspace_id

router = APIRouter(tags=["library-answers"])
logger = logging.getLogger(__name__)


def service():
    return LibraryAnswerService(get_document_service())


async def respond(operation):
    try:
        return APIResponse(success=True, data=await operation)
    except AnswerError as error:
        code, message, status = error.code, error.message, error.status
    except AIRequestError as error:
        code, message, status = "ANSWER_PREFLIGHT_FAILED", error.public_message, error.status_code
    except Exception as error:
        logger.warning("Library answer operation failed: %s", type(error).__name__)
        code, message, status = "ANSWER_UNAVAILABLE", "Library answers are unavailable. Refresh saved status before another paid request; no automatic retry was made.", 503
    return JSONResponse(status_code=status, content=create_error_response(code, message).model_dump())


async def body(request, model):
    try:
        return model.model_validate(await request.json())
    except (ValidationError, ValueError, TypeError):
        raise AnswerError("INVALID_ANSWER_REQUEST", "The answer request is invalid. Preview the intended search results again.", 422) from None


@router.post("/library/answers/preview")
async def preview(request: Request, workspace=Depends(get_workspace_id), engine=Depends(service)):
    async def operation():
        return await engine.preview(workspace, (await body(request, PreviewAnswer)).context_id)
    return await respond(operation())


@router.post("/library/answers")
async def start(request: Request, workspace=Depends(get_workspace_id), engine=Depends(service)):
    async def operation():
        return await engine.start(workspace, await body(request, StartAnswer))
    return await respond(operation())


@router.get("/library/answers")
async def recent(workspace=Depends(get_workspace_id), engine=Depends(service)):
    return await respond(engine.recent(workspace))


@router.get("/library/answers/{request_id}")
async def read(request_id: UUID, workspace=Depends(get_workspace_id), engine=Depends(service)):
    return await respond(engine.read(workspace, request_id))


@router.post("/library/answers/{request_id}/interrupt")
async def interrupt(request_id: UUID, workspace=Depends(get_workspace_id), engine=Depends(service)):
    return await respond(engine.interrupt(workspace, request_id))
