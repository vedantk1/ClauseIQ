"""Durable answer attempts in the existing workspace database, not a second store."""

from pymongo.errors import DuplicateKeyError

from services.library_answers.context import fingerprint


class AnswerRepository:
    def __init__(self, documents):
        self.documents = documents

    async def collection(self):
        return (await self.documents._get_db())._get_collection("library_answers")

    async def get(self, workspace, request_id):
        return await (await self.collection()).find_one({"_id": fingerprint([workspace, request_id]), "workspace_id": workspace})

    async def recent(self, workspace):
        cursor = (await self.collection()).find({"workspace_id": workspace}, {
            "_id": 0, "request_id": 1, "question": 1, "created_at": 1, "status": 1, "outcome": 1,
        }).sort([("created_at", -1), ("request_id", 1)]).limit(20)
        return await cursor.to_list(length=20)

    async def count(self, workspace):
        return await (await self.collection()).count_documents({"workspace_id": workspace})

    async def claim(self, record):
        try:
            await (await self.collection()).insert_one({**record, "_id": fingerprint([record["workspace_id"], record["request_id"]])})
            return True
        except DuplicateKeyError:
            return False

    async def finish(self, workspace, request_id, fields):
        result = await (await self.collection()).update_one({
            "_id": fingerprint([workspace, request_id]), "workspace_id": workspace, "status": "processing",
        }, {"$set": fields})
        return result.matched_count == 1

    async def purge_document(self, workspace, document_id):
        # Keep the immutable request fingerprint/ID to prevent replay. Remove all
        # cross-document answer content as one unit: partial redaction could lie.
        await (await self.collection()).update_many({"workspace_id": workspace, "document_ids": document_id}, {
            "$set": {"status": "source_unavailable", "outcome": None,
                     "failure": "An associated agreement was deleted. This answer's content was removed.",
                     "statements": [], "limitations": [], "evidence": []},
            "$unset": {"question": "", "context": ""},
        })
