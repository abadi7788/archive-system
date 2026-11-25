import os
import tempfile
import uuid
from typing import Annotated
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.access import build_document_visibility_clause
from app.api.deps import current_user
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.user import User

router = APIRouter()


def _rtl(value: str) -> str:
    if any("\u0600" <= ch <= "\u06ff" for ch in value):
        try:
            import arabic_reshaper
            from bidi.algorithm import get_display

            return get_display(arabic_reshaper.reshape(value))
        except Exception:
            return value
    return value


@router.get("/documents/export")
async def export_documents(
    format: Annotated[str, Query(pattern="^(xlsx|pdf)$")],
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    ids: Annotated[list[uuid.UUID], Query(min_length=1, max_length=500)],
):
    unique = list(dict.fromkeys(ids))
    vis = await build_document_visibility_clause(user, db)
    rows = (
        await db.scalars(
            select(Document).where(Document.id.in_(unique), vis).order_by(Document.created_at.desc())
        )
    ).all()
    if len(rows) != len(unique):
        raise HTTPException(404, "One or more documents are unavailable")
    fd, path = tempfile.mkstemp(prefix="archive-export-", suffix="." + format)
    os.close(fd)
    try:
        if format == "xlsx":
            book = Workbook()
            sheet = book.active
            sheet.title = "Archive documents"
            sheet.append(
                ["File name", "Classification", "Department", "MIME type", "Created at", "Summary", "Keywords", "Extracted text"]
            )
            for d in rows:
                sheet.append(
                    [
                        d.file_name,
                        d.classification,
                        d.department,
                        d.mime_type,
                        d.created_at.strftime("%Y-%m-%d %H:%M") if d.created_at else "",
                        d.summary,
                        ", ".join(d.keywords or []),
                        d.extracted_text,
                    ]
                )
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions
            for col, width in {"A": 32, "B": 22, "C": 22, "D": 22, "E": 26, "F": 48, "G": 38, "H": 80}.items():
                sheet.column_dimensions[col].width = width
            book.save(path)
            media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "archive-export.xlsx"
        else:
            font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            if os.path.exists(font) and "ArchiveUnicode" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("ArchiveUnicode", font))
            family = "ArchiveUnicode" if "ArchiveUnicode" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
            styles = getSampleStyleSheet()
            title = ParagraphStyle("ArchiveTitle", parent=styles["Title"], fontName=family, fontSize=16, leading=21)
            body = ParagraphStyle("ArchiveBody", parent=styles["BodyText"], fontName=family, fontSize=9, leading=13, wordWrap="CJK")
            story = [Paragraph(_rtl("Archive-Yemany — Document export"), title), Spacer(1, 8)]
            for index, d in enumerate(rows):
                story.append(Paragraph(_rtl(escape(d.file_name)), styles["Heading2"]))
                meta = " · ".join(
                    x
                    for x in [
                        d.classification,
                        d.department,
                        d.mime_type,
                        d.created_at.strftime("%Y-%m-%d %H:%M") if d.created_at else "",
                    ]
                    if x
                )
                if meta:
                    story.append(Paragraph(_rtl(escape(meta)), body))
                if d.summary:
                    story.append(Paragraph("<b>" + _rtl("Summary") + ":</b> " + _rtl(escape(d.summary)), body))
                if d.keywords:
                    story.append(Paragraph("<b>" + _rtl("Keywords") + ":</b> " + _rtl(escape(", ".join(d.keywords))), body))
                text = (d.extracted_text or "")[:12000]
                if text:
                    story.append(Spacer(1, 4))
                    story.append(Paragraph(_rtl(escape(text).replace("\n", "<br/>")), body))
                if index < len(rows) - 1:
                    story.append(PageBreak())
            SimpleDocTemplate(
                path,
                pagesize=A4,
                rightMargin=18 * mm,
                leftMargin=18 * mm,
                topMargin=18 * mm,
                bottomMargin=18 * mm,
                title="Archive document export",
            ).build(story)
            media = "application/pdf"
            filename = "archive-export.pdf"
        for d in rows:
            db.add(AuditLog(actor_id=user.id, action="document.exported", resource_type="document", resource_id=str(d.id), detail={"format": format}))
        await db.commit()
    except Exception:
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    return FileResponse(
        path,
        media_type=media,
        filename=filename,
        background=BackgroundTask(os.unlink, path),
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, private", "Pragma": "no-cache"},
    )
