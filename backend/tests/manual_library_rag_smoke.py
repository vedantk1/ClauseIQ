"""Opt-in real-storage end-to-end rehearsal; providers forbidden, not a quality run."""

import argparse
import asyncio
from contextlib import asynccontextmanager
import hashlib
import json
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from evaluations.library_rag_live import collect, plan, ROOT
from services.library_answers.context import fingerprint
from services.library_semantic.source import DIMENSIONS


async def run():
    logging.disable(logging.CRITICAL)
    with patch("openai.AsyncOpenAI", side_effect=AssertionError("No provider allowed")), \
         patch("openai.OpenAI", side_effect=AssertionError("No provider allowed")):
        prepared, manifest = await plan()
        async def embedding(texts, key):
            # Deterministic arbitrary vectors exercise storage only, not retrieval quality.
            vectors = []
            for text in texts:
                digest = hashlib.sha256(text.encode()).digest()
                vectors.append([(digest[index % len(digest)] + 1) / 256 for index in range(DIMENSIONS)])
            return vectors, len(texts)

        @asynccontextmanager
        async def client_factory(key):
            async def create(**kwargs):
                return SimpleNamespace(choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(
                    refusal=None, content=json.dumps({"outcome": "insufficient_evidence", "statements": [],
                        "limitations": ["Deterministic provider stub; no quality assessment."]})))],
                    usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, total_tokens=150))
            client = SimpleNamespace(base_url="https://api.openai.com/v1/", chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
            client.with_options = lambda **kwargs: client
            yield client

        report = await collect(prepared, manifest, cap="1.30", approved_plan=fingerprint(manifest),
            key_loader=AsyncMock(return_value="noncredential-stub"), client_factory=client_factory,
            embedding_provider=embedding, directory=ROOT / ".local-only/library-rag-rehearsal" / uuid4().hex)
        assert report["status"] == "completed" and report["cleanup"] == "completed", report.get("error_type")
        assert report["answer_requests"] == 8 and report["embedding_requests"] == 6
        print(json.dumps({"passed": True, "provider_calls": 0, "stub_answers": 8, "stub_embeddings": 6,
                          "cleanup": report["cleanup"], "quality_assessment": "not performed"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-isolated-live", action="store_true")
    if parser.parse_args().run_isolated_live:
        asyncio.run(run())
    else:
        print("Dry run: --run-isolated-live allows owned temporary Mongo/GridFS/Qdrant data. No paid calls.")
