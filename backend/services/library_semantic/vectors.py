"""Source-identity-only Qdrant payloads; never share the legacy chat collection."""

from uuid import NAMESPACE_URL, uuid5

from qdrant_client import AsyncQdrantClient, models

from services.library_semantic.source import DIMENSIONS, SemanticError, digest, validate_vector


def scope_filter(workspace, document=None, generations=None):
    must = [models.FieldCondition(key="workspace_id", match=models.MatchValue(value=workspace))]
    if document is not None:
        must.append(models.FieldCondition(key="document_id", match=models.MatchValue(value=document)))
    if generations is not None:
        if not generations:
            raise ValueError("Never search an empty generation allowlist")
        must.append(models.FieldCondition(key="generation_id", match=models.MatchAny(any=list(generations))))
    return models.Filter(must=must)


def collection_names(base, database, prefix):
    """Separate embedding spaces; old Library points are cleanup-only, never searched."""
    namespace = digest([database, prefix])[:16]
    return f"{base}-library-v2-{namespace}", (f"{base}-library-v1-{namespace}",)


class LibraryVectors:
    def __init__(self, client, collection, *, cleanup_collections=()):
        self.client, self.collection = client, collection
        self.cleanup_collections = tuple(dict.fromkeys(cleanup_collections))

    async def exists(self):
        return await self.client.collection_exists(self.collection)

    async def ensure(self):
        if not await self.exists():
            await self.client.create_collection(self.collection, vectors_config=models.VectorParams(
                size=DIMENSIONS, distance=models.Distance.COSINE))
            for field in ("workspace_id", "document_id", "generation_id"):
                await self.client.create_payload_index(self.collection, field, models.PayloadSchemaType.KEYWORD, wait=True)
        info = await self.client.get_collection(self.collection)
        config = info.config.params.vectors
        if not isinstance(config, models.VectorParams) or config.size != DIMENSIONS or config.distance != models.Distance.COSINE:
            raise SemanticError("INDEX_INCOMPATIBLE", "The Library vector collection has an incompatible configuration.", 503)

    async def count(self, workspace, document, generation):
        if not await self.exists():
            return 0
        result = await self.client.count(self.collection,
            count_filter=scope_filter(workspace, document, [generation]), exact=True)
        return result.count

    async def put(self, workspace, document, generation, plan, vectors):
        points = []
        for passage, vector in zip(plan.passages.values(), vectors, strict=True):
            validate_vector(vector)
            identity = [workspace, document, generation, passage.id]
            points.append(models.PointStruct(id=str(uuid5(NAMESPACE_URL, digest(identity))), vector=vector,
                payload={"workspace_id": workspace, "document_id": document, "generation_id": generation,
                         "source_revision_id": passage.source_revision_id, "passage_id": passage.id,
                         "page_number": passage.page_number, "text_sha256": digest(passage.text),
                         "fingerprint": plan.fingerprint}))
        for start in range(0, len(points), 64):
            result = await self.client.upsert(self.collection, points[start:start + 64], wait=True)
            if result.status != models.UpdateStatus.COMPLETED:
                raise SemanticError("INDEX_WRITE_UNCONFIRMED", "Vector storage did not confirm the complete index.", 503)

    async def remove(self, workspace, document, generation=None):
        # Only deliberate removal/deletion or confirmed rebuild reaches cleanup.
        # Previous Library model spaces are never queried, migrated or dropped.
        selector = scope_filter(workspace, document, [generation] if generation else None)
        for collection in dict.fromkeys((self.collection, *self.cleanup_collections)):
            if not await self.client.collection_exists(collection):
                continue
            result = await self.client.delete(collection, models.FilterSelector(filter=selector), wait=True)
            if result.status != models.UpdateStatus.COMPLETED:
                raise SemanticError("INDEX_DELETE_UNCONFIRMED", "Index cleanup is not confirmed. The agreement was not deleted.", 503)
            if (await self.client.count(collection, count_filter=selector, exact=True)).count:
                raise SemanticError("INDEX_DELETE_UNCONFIRMED", "Index cleanup is incomplete. Retry removal explicitly.", 503)

    async def search(self, workspace, generations, vector, limit):
        if not generations:
            raise ValueError("Current source generations are required")
        validate_vector(vector)
        scope = models.Filter(must=[scope_filter(workspace)], should=[
            scope_filter(workspace, document, [generation]) for document, generation in generations.items()])
        return (await self.client.query_points(self.collection, query=vector,
            query_filter=scope,
            search_params=models.SearchParams(exact=True), with_payload=True, with_vectors=False, limit=limit)).points

    async def close(self):
        await self.client.close()


async def create_vectors(documents):
    from config.environments import get_environment_config
    config = get_environment_config().qdrant
    db = await documents._get_db()
    # Different local Mongo installations must not collide in a shared Qdrant.
    collection, previous_collections = collection_names(config.collection_name, db.config.database, db.config.collection_prefix)
    client = AsyncQdrantClient(host=config.host, port=config.port, api_key=config.api_key, timeout=10)
    return LibraryVectors(client, collection, cleanup_collections=previous_collections)
