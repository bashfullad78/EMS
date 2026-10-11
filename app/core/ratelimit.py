"""Simple in-memory sliding-window rate limiting for sensitive endpoints."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.config import settings

WINDOW_SECONDS = 60

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def reset() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _hits.clear()


def client_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def enforce(request: Request, bucket: str, limit: int, window: int = WINDOW_SECONDS) -> None:
    """Record one hit for `bucket`; raise 429 with Retry-After when over limit."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    key = f"{bucket}:{client_key(request)}"
    now = time.monotonic()
    with _lock:
        hits = _hits[key]
        while hits and now - hits[0] >= window:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = max(1, int(window - (now - hits[0])) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests; try again in {retry_after} seconds",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


def rate_limit(setting_name: str, window: int = WINDOW_SECONDS):
    """Dependency factory reading its limit from settings, e.g.

        Depends(rate_limit("RATE_LIMIT_LOGIN_PER_MINUTE"))
    """

    def dependency(request: Request) -> None:
        limit = int(getattr(settings, setting_name))
        enforce(request, bucket=setting_name, limit=limit, window=window)

    return dependency
