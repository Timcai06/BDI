from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.services.task_service import TaskService

logger = logging.getLogger(__name__)


class TaskWorker:
    def __init__(self, *, task_service: TaskService, poll_interval_seconds: float = 1.0) -> None:
        self.task_service = task_service
        self.poll_interval_seconds = max(0.1, poll_interval_seconds)
        self._task: Optional[asyncio.Task] = None
        self._stopping = False

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stopping = False
        self._task = asyncio.create_task(self._run_loop(), name="bdi-task-worker")
        logger.info("Task worker started (interval=%.2fs)", self.poll_interval_seconds)

    async def stop(self) -> None:
        self._stopping = True
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        logger.info("Task worker stopped")

    async def _run_loop(self) -> None:
        while not self._stopping:
            try:
                result = self.task_service.process_next_queued_task()
                if result.processed:
                    await asyncio.sleep(0.01)
                    continue
                await asyncio.sleep(self.poll_interval_seconds)
            except Exception:
                logger.exception("Task worker loop failed; retrying")
                await asyncio.sleep(self.poll_interval_seconds)
