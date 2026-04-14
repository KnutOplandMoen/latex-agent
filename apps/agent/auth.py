"""Clerk JWT verification for the agent service.

Mirrors the auth pattern used in apps/collab — verifies JWTs using Clerk's
JWKS endpoint, with a dev bypass when CLERK_SECRET_KEY is unset.
"""

from __future__ import annotations

import logging
from typing import Any

import jwt as pyjwt
from pydantic import BaseModel

from config import CLERK_SECRET_KEY, DEV_MODE

logger = logging.getLogger(__name__)

_jwks_client: pyjwt.PyJWKClient | None = None


class AuthUser(BaseModel):
    id: str
    email: str


DEV_USER = AuthUser(id="dev_user", email="dev@localhost")


async def _discover_jwks_uri_from_token(token: str) -> str:
    """Extract the issuer from an unverified JWT and build JWKS URI."""
    unverified = pyjwt.decode(token, options={"verify_signature": False})
    issuer = unverified.get("iss", "")
    if not issuer:
        raise ValueError("Token has no issuer claim")
    return f"{issuer.rstrip('/')}/.well-known/jwks.json"


async def verify_token(token: str) -> AuthUser:
    """Verify a Clerk JWT and return the authenticated user.

    In dev mode (no CLERK_SECRET_KEY), returns a static dev user.
    """
    if DEV_MODE:
        return DEV_USER

    if not token:
        raise PermissionError("Missing authentication token")

    global _jwks_client

    # Discover JWKS URI from the token's issuer on first call
    if _jwks_client is None:
        jwks_uri = await _discover_jwks_uri_from_token(token)
        _jwks_client = pyjwt.PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600)

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload: dict[str, Any] = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except pyjwt.exceptions.PyJWTError as exc:
        raise PermissionError(f"Invalid token: {exc}") from exc

    user_id = payload.get("sub", "")
    email = payload.get("email", "")

    if not user_id:
        raise PermissionError("Token has no subject")

    return AuthUser(id=user_id, email=email)
