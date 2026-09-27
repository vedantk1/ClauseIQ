"""Local single-process lifecycle serialization; durable state still fences writes."""

import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4
from weakref import WeakValueDictionary

RUNTIME_ID = str(uuid4())
_locks = WeakValueDictionary()
active_attempts = set()


@asynccontextmanager
async def document_lock(workspace, document):
    key = (workspace, document)
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    async with lock:
        yield
