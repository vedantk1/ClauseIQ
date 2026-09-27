"""Scoped projections and durable query receipts, using the existing database."""

from pymongo.errors import DuplicateKeyError

from database.library_search import search_source_projection
from services.library_semantic.source import digest


class SemanticRepository:
    def __init__(self, documents):
        self.documents = documents

    async def list(self, workspace, limit=100):
        db = await self.documents._get_db()
        collection = db._get_collection("documents")
        total = await collection.count_documents({"workspace_id": workspace})
        cursor = collection.find({"workspace_id": workspace},
            {**search_source_projection(), "semantic_index": 1}).sort([("upload_date", -1), ("id", 1)]).limit(limit)
        return total, await cursor.to_list(length=limit)

    async def receipts(self):
        return (await self.documents._get_db())._get_collection("semantic_search_receipts")

    async def claim_query(self, workspace, request_id, query_hash):
        collection = await self.receipts()
        identity = digest([workspace, request_id])
        record = {"_id": identity, "workspace_id": workspace, "query_hash": query_hash, "status": "processing"}
        try:
            await collection.insert_one(record)
            return True, record
        except DuplicateKeyError:
            return False, await collection.find_one({"_id": identity, "workspace_id": workspace})

    async def finish_query(self, workspace, request_id, status, usage=None):
        # No query text, result excerpts, credentials or private exception strings.
        await (await self.receipts()).update_one(
            {"_id": digest([workspace, request_id]), "workspace_id": workspace, "status": "processing"},
            {"$set": {"status": status, "input_tokens": usage}}, upsert=False)
