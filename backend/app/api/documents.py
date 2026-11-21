import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Request
from fastapi.responses import Response
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import current_user
from app.db import get_db
from app.models.document import Document
from app.models.audit_log import AuditLog
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole
from app.services.gemini_service import AllGeminiKeysExhausted, GeminiOCRService, GeminiRequestFailed
from app.services.storage_service import get_storage

router=APIRouter()
MAX_UPLOAD_BYTES=30*1024*1024
ALLOWED_TYPES={"application/pdf","image/jpeg","image/png","image/webp","image/tiff"}


def _visible_to(user: User):
    if user.role==UserRole.ADMIN:
        return True
    shared=select(FolderGrant.folder_id).where(FolderGrant.user_id==user.id)
    return or_(Document.user_id==user.id, Document.folder_id.in_(shared))

async def _can_write_doc(doc:Document,user:User,db:AsyncSession)->bool:
    if user.role==UserRole.VIEWER:return False
    if user.role==UserRole.ADMIN or doc.user_id==user.id:return True
    if doc.folder_id:
        return bool(await db.scalar(select(FolderGrant.id).where(FolderGrant.folder_id==doc.folder_id,FolderGrant.user_id==user.id,FolderGrant.permission=="write")))
    return False

@router.post("",status_code=201)
async def upload_document(file:Annotated[UploadFile,File()],user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],request:Request,folder_id:Annotated[str|None,Form()]=None,department:Annotated[str|None,Form()]=None):
    if user.role==UserRole.VIEWER: raise HTTPException(403,"Viewer accounts cannot upload or modify documents")
    if file.content_type not in ALLOWED_TYPES: raise HTTPException(415,"Only PDF and supported image files are accepted")
    content=await file.read(MAX_UPLOAD_BYTES+1)
    if not content or len(content)>MAX_UPLOAD_BYTES: raise HTTPException(413,"File is empty or exceeds the 30 MiB limit")
    valid=(file.content_type=="application/pdf" and content.startswith(b"%PDF-")) or (file.content_type=="image/jpeg" and content.startswith(b"\xff\xd8\xff")) or (file.content_type=="image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")) or (file.content_type=="image/webp" and content[:4]==b"RIFF" and content[8:12]==b"WEBP") or (file.content_type=="image/tiff" and content[:4] in (b"II*\x00",b"MM\x00*"))
    if not valid: raise HTTPException(415,"File content does not match its declared type")
    folder=None
    if folder_id:
        try: folder=await db.get(Folder,uuid.UUID(folder_id))
        except ValueError: raise HTTPException(422,"Invalid folder id")
        if not folder: raise HTTPException(404,"Folder not found")
        allowed=folder.owner_id==user.id or user.role==UserRole.ADMIN or bool(await db.scalar(select(FolderGrant.id).where(FolderGrant.folder_id==folder.id,FolderGrant.user_id==user.id,FolderGrant.permission=="write")))
        if not allowed: raise HTTPException(403,"Write access to this folder is required")
    did=uuid.uuid4(); name=(file.filename or "document").replace("/","_").replace("\\","_")[:250]; key=f"{user.id}/{did}"
    doc=Document(id=did,user_id=user.id,folder_id=folder.id if folder else None,department=(department or user.department),file_name=name,file_path=key,mime_type=file.content_type,file_size=len(content),processing_status="queued")
    db.add(doc); await db.flush()
    try: await get_storage().put(key,content,file.content_type)
    except Exception as exc: await db.rollback(); raise HTTPException(503,"Document storage is temporarily unavailable") from exc
    try:
        out=await GeminiOCRService().extract(content,file.content_type,user_key_encrypted=user.gemini_key_encrypted)
        doc.extracted_text=out["extracted_text"]; doc.summary=out.get("summary"); doc.processed_by_key=out.get("processed_by_key")
        doc.classification=out.get("classification") or out.get("document_type")
        doc.keywords=out.get("keywords") or out.get("metadata",{}).get("keywords",[])
        doc.metadata_json=out.get("metadata",{})|{"language":out.get("language"),"document_type":out.get("document_type"),"keywords":doc.keywords}
        doc.department=doc.department or out.get("metadata",{}).get("department")
        doc.processing_status="completed"
    except AllGeminiKeysExhausted:
        doc.processing_status="queued"; doc.processing_error="All OCR keys exhausted; awaiting retry"
    except GeminiRequestFailed:
        doc.processing_status="failed"; doc.processing_error="OCR provider error; administrator review required"
    db.add(AuditLog(actor_id=user.id,action="document.uploaded",resource_type="document",resource_id=str(did),detail={"file_name":name,"size":len(content),"status":doc.processing_status,"folder_id":str(folder.id) if folder else None},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")))
    await db.commit()
    return {"id":str(did),"file_name":name,"status":doc.processing_status,"extracted_text":doc.extracted_text or "","summary":doc.summary,"classification":doc.classification,"keywords":doc.keywords,"metadata":doc.metadata_json}

@router.get("")
async def list_documents(user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],department:str|None=None,mime_type:str|None=None,classification:str|None=None,folder_id:uuid.UUID|None=None,from_date:str|None=None,to_date:str|None=None,keyword:str|None=None,limit:int=100):
    if not 1<=limit<=250: raise HTTPException(422,"Limit must be 1-250")
    q=select(Document).where(_visible_to(user))
    if department:q=q.where(Document.department==department)
    if mime_type:q=q.where(Document.mime_type==mime_type)
    if classification:q=q.where(Document.classification==classification)
    if folder_id:q=q.where(Document.folder_id==folder_id)
    if from_date:
        from datetime import date,datetime,time,timezone
        try:q=q.where(Document.created_at>=datetime.combine(date.fromisoformat(from_date),time.min,tzinfo=timezone.utc))
        except ValueError:raise HTTPException(422,"from_date must use YYYY-MM-DD")
    if to_date:
        from datetime import date,datetime,time,timedelta,timezone
        try:q=q.where(Document.created_at<datetime.combine(date.fromisoformat(to_date)+timedelta(days=1),time.min,tzinfo=timezone.utc))
        except ValueError:raise HTTPException(422,"to_date must use YYYY-MM-DD")
    if keyword:q=q.where(Document.keywords.contains([keyword]))
    rows=(await db.scalars(q.order_by(Document.created_at.desc()).limit(limit))).all()
    return [{"id":str(d.id),"file_name":d.file_name,"mime_type":d.mime_type,"file_size":d.file_size,"summary":d.summary,"snippet":(d.extracted_text or "")[:350],"status":d.processing_status,"classification":d.classification,"department":d.department,"keywords":d.keywords,"folder_id":str(d.folder_id) if d.folder_id else None,"created_at":d.created_at} for d in rows]

@router.get("/{document_id}")
async def document_details(document_id:uuid.UUID,user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],request:Request):
    doc=await db.scalar(select(Document).where(Document.id==document_id,_visible_to(user)))
    if not doc:raise HTTPException(404,"Document not found")
    db.add(AuditLog(actor_id=user.id,action="document.opened",resource_type="document",resource_id=str(doc.id),detail={},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")))
    await db.commit()
    return {"id":str(doc.id),"file_name":doc.file_name,"extracted_text":doc.extracted_text,"summary":doc.summary,"classification":doc.classification,"department":doc.department,"keywords":doc.keywords,"metadata":doc.metadata_json,"status":doc.processing_status}

@router.patch("/{document_id}")
async def edit_document(document_id:uuid.UUID,payload:dict,user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],request:Request):
    doc=await db.get(Document,document_id)
    if not doc:raise HTTPException(404,"Document not found")
    if not await _can_write_doc(doc,user,db):raise HTTPException(403,"You cannot edit this document")
    allowed={"file_name","department","classification","keywords","summary","folder_id"}; changes=[]
    for key,value in payload.items():
        if key not in allowed:raise HTTPException(422,f"Field cannot be edited: {key}")
        if key=="folder_id" and value:
            try: fid=uuid.UUID(value)
            except Exception:raise HTTPException(422,"Invalid folder id")
            folder=await db.get(Folder,fid)
            if not folder:raise HTTPException(404,"Folder not found")
            if folder.owner_id!=user.id and user.role!=UserRole.ADMIN and not await db.scalar(select(FolderGrant.id).where(FolderGrant.folder_id==fid,FolderGrant.user_id==user.id,FolderGrant.permission=="write")):raise HTTPException(403,"Write access required")
            doc.folder_id=fid
        else:
            if key=="keywords" and (not isinstance(value,list) or len(value)>50 or not all(isinstance(item,str) and len(item)<=80 for item in value)):
                raise HTTPException(422,"keywords must be a list of up to 50 short strings")
            setattr(doc,key,value)
        changes.append(key)
    if "keywords" in changes:
        doc.metadata_json={**(doc.metadata_json or {}),"keywords":doc.keywords}
    if "classification" in changes:
        doc.metadata_json={**(doc.metadata_json or {}),"classification":doc.classification}
    db.add(AuditLog(actor_id=user.id,action="document.edited",resource_type="document",resource_id=str(doc.id),detail={"fields":changes},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")))
    await db.commit();return {"id":str(doc.id),"file_name":doc.file_name,"classification":doc.classification,"department":doc.department,"keywords":doc.keywords}

@router.delete("/{document_id}",status_code=204)
async def delete_document(document_id:uuid.UUID,user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],request:Request):
    doc=await db.get(Document,document_id)
    if not doc:raise HTTPException(404,"Document not found")
    if not await _can_write_doc(doc,user,db):raise HTTPException(403,"You cannot delete this document")
    name=doc.file_name; key=doc.file_path
    db.add(AuditLog(actor_id=user.id,action="document.deleted",resource_type="document",resource_id=str(doc.id),detail={"file_name":name},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")))
    await db.delete(doc);await db.commit()
    try:await get_storage().delete(key)
    except Exception:pass
    return Response(status_code=204)

@router.get("/{document_id}/file")
async def retrieve_document(document_id:uuid.UUID,user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],request:Request):
    doc=await db.scalar(select(Document).where(Document.id==document_id,_visible_to(user)))
    if not doc:raise HTTPException(404,"Document not found")
    try:body=await get_storage().get(doc.file_path)
    except Exception as exc:raise HTTPException(503,"Document storage is temporarily unavailable") from exc
    db.add(AuditLog(actor_id=user.id,action="document.downloaded",resource_type="document",resource_id=str(doc.id),detail={},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")))
    await db.commit()
    return Response(body,media_type=doc.mime_type,headers={"Cache-Control":"no-store, no-cache, must-revalidate, private","Pragma":"no-cache","Content-Disposition":f'inline; filename="{doc.file_name}"',"X-Content-Type-Options":"nosniff"})
