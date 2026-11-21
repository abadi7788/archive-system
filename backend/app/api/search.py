from datetime import date,datetime,time,timedelta,timezone
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter,Depends,Query,HTTPException
from sqlalchemy import func,select,or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import current_user
from app.db import get_db
from app.models.document import Document
from app.models.folder import FolderGrant
from app.models.user import User,UserRole

router=APIRouter()
@router.get("")
async def search_documents(user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)],q:Annotated[str|None,Query(max_length=200)]=None,department:str|None=None,mime_type:str|None=None,classification:str|None=None,folder_id:UUID|None=None,keyword:str|None=None,from_date:str|None=None,to_date:str|None=None,limit:Annotated[int,Query(ge=1,le=100)]=30):
 query=select(Document)
 if user.role!=UserRole.ADMIN:
  granted=select(FolderGrant.folder_id).where(FolderGrant.user_id==user.id)
  query=query.where(or_(Document.user_id==user.id,Document.folder_id.in_(granted)))
 if q and q.strip():
  tsquery=func.websearch_to_tsquery("simple",q.strip())
  query=query.where(or_(Document.search_vector.op("@@")(tsquery),Document.file_name.ilike(f"%{q.strip()}%")))
 if department:query=query.where(Document.department==department)
 if mime_type:query=query.where(Document.mime_type==mime_type)
 if classification:query=query.where(Document.classification==classification)
 if folder_id:query=query.where(Document.folder_id==folder_id)
 if keyword:query=query.where(Document.keywords.contains([keyword]))
 if from_date:
  try:query=query.where(Document.created_at>=datetime.combine(date.fromisoformat(from_date),time.min,tzinfo=timezone.utc))
  except ValueError:raise HTTPException(422,"from_date must use YYYY-MM-DD")
 if to_date:
  try:query=query.where(Document.created_at<datetime.combine(date.fromisoformat(to_date)+timedelta(days=1),time.min,tzinfo=timezone.utc))
  except ValueError:raise HTTPException(422,"to_date must use YYYY-MM-DD")
 if q:query=query.order_by(func.ts_rank(Document.search_vector,func.websearch_to_tsquery("simple",q)).desc(),Document.created_at.desc())
 else:query=query.order_by(Document.created_at.desc())
 if q and q.strip():
  headline=func.ts_headline("simple",func.coalesce(Document.extracted_text,""),func.websearch_to_tsquery("simple",q.strip()),"StartSel=⟦, StopSel=⟧, MaxWords=32, MinWords=12")
  pairs=(await db.execute(query.add_columns(headline.label("hit_snippet")).limit(limit))).all()
  return [{"id":str(d.id),"file_name":d.file_name,"mime_type":d.mime_type,"summary":d.summary,"snippet":hit_snippet or (d.summary or ""),"status":d.processing_status,"classification":d.classification,"department":d.department,"keywords":d.keywords,"folder_id":str(d.folder_id) if d.folder_id else None,"created_at":d.created_at} for d,hit_snippet in pairs]
 rows=(await db.scalars(query.limit(limit))).all()
 return [{"id":str(d.id),"file_name":d.file_name,"mime_type":d.mime_type,"summary":d.summary,"snippet":(d.extracted_text or "")[:320],"status":d.processing_status,"classification":d.classification,"department":d.department,"keywords":d.keywords,"folder_id":str(d.folder_id) if d.folder_id else None,"created_at":d.created_at} for d in rows]
