"""Shared FastAPI dependencies: DB session and current user resolution."""
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the Authorization: Bearer header."""
    if credentials is None:
        # Fall back to the OAuth2 form for swagger "Authorize" button UX.
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            raise _unauthorized()
        token = auth_header.split(" ", 1)[1].strip()
    else:
        token = credentials.credentials

    payload = decode_access_token(token)
    if payload is None:
        raise _unauthorized("Could not validate credentials")

    user_id = payload.get("sub")
    if user_id is None:
        raise _unauthorized("Could not validate credentials")

    user = db.get(User, int(user_id))
    if user is None:
        raise _unauthorized("User not found")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Alias kept for readability at router level."""
    return current_user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Guard for admin-only endpoints (event management, reports)."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have administrative privileges",
        )
    return current_user
