"""Canonical upload policy; extension AND content are validated (never trust browser MIME)."""
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

PDF = "application/pdf"
EXTENSIONS = {
    ".pdf": PDF, ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".tif": "image/tiff", ".tiff": "image/tiff", ".txt": "text/plain",
    ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
ALLOWED_TYPES = set(EXTENSIONS.values())
OOXML_PARTS = {".docx": "word/document.xml", ".xlsx": "xl/workbook.xml", ".pptx": "ppt/presentation.xml"}


def detect_file_type(stream, filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    if ext not in EXTENSIONS:
        return None
    stream.seek(0)
    head = stream.read(8192)
    stream.seek(0)
    valid = False
    if ext == ".pdf": valid = b"%PDF-" in head[:1024]
    elif ext in {".jpg", ".jpeg"}: valid = head.startswith(b"\xff\xd8\xff")
    elif ext == ".png": valid = head.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext == ".webp": valid = head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    elif ext in {".tif", ".tiff"}: valid = head[:4] in (b"II*\x00", b"MM\x00*")
    elif ext in OOXML_PARTS:
        try:
            with zipfile.ZipFile(stream) as archive:
                names = set(archive.namelist())
                valid = "[Content_Types].xml" in names and OOXML_PARTS[ext] in names
                # Macro-enabled packages cannot masquerade as non-macro extensions.
                valid = valid and not any(n.lower().endswith("vbaproject.bin") for n in names)
        except (zipfile.BadZipFile, OSError):
            valid = False
    elif ext in {".doc", ".xls", ".ppt"}:
        # Verify the OLE container and the expected application stream, not just its magic.
        try:
            import olefile
            if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
                with olefile.OleFileIO(stream) as ole:
                    expected = {".doc": ["WordDocument"], ".xls": ["Workbook", "Book"], ".ppt": ["PowerPoint Document"]}[ext]
                    valid = any(ole.exists(name) for name in expected)
        except (OSError, ValueError):
            valid = False
    elif ext == ".txt":
        try:
            # UTF-8 (optionally BOM) and UTF-16 BOM; no binary control characters.
            encoding = "utf-16" if head.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
            import codecs
            text = codecs.getincrementaldecoder(encoding)(errors="strict").decode(head, final=False)
            valid = not any(ord(c) < 32 and c not in "\n\r\t\f" for c in text)
        except UnicodeError:
            valid = False
    stream.seek(0)
    return EXTENSIONS[ext] if valid else None


def extract_local_text(content: bytes, filename: str) -> str:
    """Bounded, non-executing text extraction for TXT/OOXML; never evaluate macros/formulae."""
    import io
    ext = Path(filename).suffix.lower()
    if ext == ".txt":
        encoding = "utf-16" if content.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        return content.decode(encoding, errors="replace")[:2_000_000]
    if ext not in OOXML_PARTS:
        return ""
    parts, budget = [], 24 * 1024 * 1024
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        for info in archive.infolist():
            name = info.filename
            selected = (name == "word/document.xml" or name == "xl/sharedStrings.xml" or
                        name.startswith("xl/worksheets/sheet") and name.endswith(".xml") or
                        name.startswith("ppt/slides/slide") and name.endswith(".xml"))
            if not selected: continue
            if info.file_size > budget: break
            budget -= info.file_size
            root = ET.fromstring(archive.read(info))
            parts.append(" ".join(el.text or "" for el in root.iter() if el.tag.rsplit("}", 1)[-1] in {"t", "v"}))
            if sum(map(len, parts)) >= 2_000_000: break
    return "\n".join(parts)[:2_000_000]
