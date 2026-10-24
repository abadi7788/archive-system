from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

from app.core.config import settings

_password_hasher = PasswordHasher()  # Argon2id; parameters are intentionally library-managed.


def _fernet() -> Fernet:
    """Create a Fernet instance and fail fast on invalid/missing key configuration."""
    try:
        return Fernet(settings.master_encryption_key.get_secret_value().encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise RuntimeError("MASTER_ENCRYPTION_KEY must be a valid Fernet key") from exc


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        raise ValueError("Cannot encrypt an empty secret")
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError, ValueError) as exc:
        raise ValueError("Secret could not be decrypted; verify encryption-key configuration") from exc


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Passwords must contain at least 12 characters")
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_hash_needs_rehash(password_hash: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def create_access_token(subject: str, *, expires_minutes: int | None = None, claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "iat": now, "exp": expires, "type": "access"}
    if claims:
        # Do not allow caller-provided values to override registered security claims.
        payload.update({k: v for k, v in claims.items() if k not in {"sub", "iat", "exp", "type"}})
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require_sub": True, "require_exp": True},
        )
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        return payload
    except (JWTError, ValueError) as exc:
        raise ValueError("Invalid or expired access token") from exc
