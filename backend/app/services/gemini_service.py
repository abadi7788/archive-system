"""Gemini OCR with ordered per-user then system-key quota failover.

The caller should persist ``queued`` status and notify an administrator when
:class:`AllGeminiKeysExhausted` is raised. API keys and provider error bodies are
never included in exception messages or logs.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.security import decrypt_secret

logger = logging.getLogger(__name__)

OCR_PROMPT = """You are an accurate document OCR and metadata extraction system. Read all visible text in the supplied document or image, preserving its original language and layout as far as possible. Support Arabic (including right-to-left text), English, and mixed-language content. Do not translate, infer missing text, or omit tables, dates, names, numbers, stamps, and headings. Mark genuinely unreadable spans as [غير مقروء] or [illegible].

Return only valid JSON with this exact shape:
{"extracted_text":"...","summary":"A concise summary in the document's primary language.","language":"ar|en|mixed|other","document_type":"...","metadata":{"document_date":null,"entities":[],"keywords":[]}}"""


@dataclass(frozen=True)
class GeminiKey:
    label: str
    value: str


class AllGeminiKeysExhausted(RuntimeError):
    """Every configured key was rejected for quota/rate-limit reasons."""

    def __init__(self, tried_labels: list[str]):
        self.tried_labels = tried_labels
        super().__init__("All available Gemini keys are quota-exhausted; document should remain queued")


class GeminiRequestFailed(RuntimeError):
    """A non-quota provider failure; failover is intentionally not attempted."""


def _is_quota_error(exc: Exception) -> bool:
    """Identify only rate limits/quota exhaustion; avoid leaking provider details."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    code = code or getattr(response, "status_code", None)
    if code == 429 or str(code) == "429":
        return True
    status = str(getattr(exc, "status", "")).upper()
    if "RESOURCE_EXHAUSTED" in status or "RATE_LIMIT" in status:
        return True
    message = str(exc).lower()
    return any(term in message for term in ("429", "resource_exhausted", "quota exceeded", "rate limit"))


class GeminiOCRService:
    def __init__(self, model: str | None = None):
        self.model = model or settings.gemini_model

    @staticmethod
    def _ordered_keys(user_key_encrypted: str | None, system_keys: list[tuple[str, str]] | None) -> list[GeminiKey]:
        keys: list[GeminiKey] = []
        if user_key_encrypted:
            try:
                keys.append(GeminiKey("user", decrypt_secret(user_key_encrypted)))
            except ValueError:
                logger.warning("Ignoring an unreadable encrypted personal Gemini credential")
        if system_keys is None:
            system_keys = [(f"system-{i}", value) for i, value in enumerate(settings.system_gemini_keys, 1)]
        keys.extend(GeminiKey(label, key) for label, key in system_keys if key)
        return keys

    async def extract(
        self,
        content: bytes,
        mime_type: str,
        *,
        user_key_encrypted: str | None = None,
        system_keys: list[tuple[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Extract OCR and structured metadata. ``content`` is sent directly to Gemini."""
        if not content:
            raise ValueError("Document content must not be empty")
        if not mime_type.startswith(("application/pdf", "image/")):
            raise ValueError("Only PDF and image documents are supported")

        keys = self._ordered_keys(user_key_encrypted, system_keys)
        if not keys:
            raise AllGeminiKeysExhausted([])

        attempted: list[str] = []
        for key in keys:
            attempted.append(key.label)
            client = genai.Client(api_key=key.value, http_options=types.HttpOptions(timeout=int(settings.gemini_timeout_seconds * 1000)))
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=self.model,
                        contents=[types.Part.from_bytes(data=content, mime_type=mime_type), OCR_PROMPT],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0,
                        ),
                    ),
                    timeout=settings.gemini_timeout_seconds,
                )
                text = response.text or ""
                result = json.loads(text)
                if not isinstance(result, dict) or not isinstance(result.get("extracted_text"), str):
                    raise ValueError("Gemini returned an unexpected OCR response shape")
                result["processed_by_key"] = key.label
                return result
            except Exception as exc:
                if _is_quota_error(exc):
                    logger.info("Gemini quota exhausted for key tier %s; trying next configured tier", key.label)
                    continue
                logger.exception("Gemini OCR request failed for key tier %s", key.label)
                raise GeminiRequestFailed(f"Gemini OCR failed using key tier {key.label}") from exc
            finally:
                # SDK client cleanup is best-effort and doesn't change request outcome.
                aclose = getattr(client.aio, "aclose", None)
                if aclose:
                    try:
                        await aclose()
                    except Exception:
                        pass
        raise AllGeminiKeysExhausted(attempted)
