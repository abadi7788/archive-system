"""Shared rename validation and serialized sibling-namespace collision checks."""
import unicodedata
from pathlib import PurePath
import uuid
from fastapi import HTTPException
from sqlalchemy import func, select, text
from app.models.document import Document
from app.models.folder import Folder


def validate_name(value: str, max_length: int = 180) -> str:
    if not isinstance(value, str): raise HTTPException(422, "Invalid name")
    name = unicodedata.normalize("NFC", value).strip()
    if not name or name in {".", ".."} or len(name) > max_length or name.endswith("."):
        raise HTTPException(422, "Name is empty, too long, or ends with a dot")
    if any(c in '<>:"/\\|?*' or unicodedata.category(c).startswith("C") for c in name):
        raise HTTPException(422, "Name contains invalid characters")
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
    if name.split(".")[0].upper() in reserved:
        raise HTTPException(422, "This name is reserved")
    return name


def renamed_file(old: str, proposed: str) -> str:
    suffix = PurePath(old).suffix
    stem = proposed.strip() if isinstance(proposed, str) else ""
    if suffix and stem.lower().endswith(suffix.lower()): stem = stem[:-len(suffix)]
    stem = validate_name(stem, 250 - len(suffix))
    return validate_name(stem + suffix, 250)


async def available_name(db, kind: str, name: str, parent_id: uuid.UUID | None, owner_id: uuid.UUID, exclude=None):
    # A common lock serializes create/rename in the destination namespace. Root is per-owner.
    namespace = str(parent_id) if parent_id else f"root:{owner_id}"
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"names:{kind}:{namespace}"})
    model = Document if kind == "document" else Folder
    field = Document.file_name if kind == "document" else Folder.name
    parent = Document.folder_id if kind == "document" else Folder.parent_id
    owner = Document.user_id if kind == "document" else Folder.owner_id
    query = select(model.id).where(model.deleted_at.is_(None), parent == parent_id, func.lower(field) == name.lower())
    if parent_id is None: query = query.where(owner == owner_id)
    if exclude: query = query.where(model.id != exclude)
    if await db.scalar(query.limit(1)):
        raise HTTPException(409, "A name already exists in this folder")
