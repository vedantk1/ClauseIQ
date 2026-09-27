"""One bounded request, no retry, no returned provider error text."""

from services.ai.client_manager import workspace_openai_client
from services.library_semantic.source import DIMENSIONS, MAX_TOTAL_TOKENS, MODEL, SemanticError, validate_vector


async def embed(texts, api_key):
    async with workspace_openai_client(api_key) as client:
        response = await client.with_options(max_retries=0, timeout=45).embeddings.create(
            model=MODEL, dimensions=DIMENSIONS, encoding_format="float", input=texts)
    if response.model != MODEL or len(response.data) != len(texts):
        raise SemanticError("INVALID_EMBEDDING", "Unexpected embedding response; no automatic retry was made.", 502)
    ordered = {}
    for item in response.data:
        if type(item.index) is not int or not 0 <= item.index < len(texts) or item.index in ordered:
            raise SemanticError("INVALID_EMBEDDING", "Invalid embedding order; no automatic retry was made.", 502)
        validate_vector(item.embedding)
        ordered[item.index] = item.embedding
    usage = response.usage.prompt_tokens
    if type(usage) is not int or not 0 < usage <= MAX_TOTAL_TOKENS or response.usage.total_tokens != usage:
        raise SemanticError("UNKNOWN_USAGE", "Embedding usage is unconfirmed; no automatic retry was made.", 502)
    return [ordered[index] for index in range(len(texts))], usage
