import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy import select,or_,func
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import current_user,admin_user
from app.db import get_db
from app.models.folder import Folder,FolderGrant
from app.models.document import Document
from app.models.user import User,UserRole

router=APIRouter()
class FolderCreate(BaseModel):
 name:str=Field(min_length=1,max_length=180)
 parent_id:uuid.UUID|None=None
class GrantCreate(BaseModel):
 user_id:uuid.UUID
 permission:str=Field(pattern="^(read|write)$")

@router.get("")
async def list_folders(user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)]):
 q=select(Folder)
 if user.role!=UserRole.ADMIN:
  shared=select(FolderGrant.folder_id).where(FolderGrant.user_id==user.id)
  q=q.where(or_(Folder.owner_id==user.id,Folder.id.in_(shared)))
 folders=(await db.scalars(q.order_by(Folder.name))).all()
 return [{"id":str(f.id),"name":f.name,"parent_id":str(f.parent_id) if f.parent_id else None,"path":f.path,"owner_id":str(f.owner_id)} for f in folders]

@router.post("",status_code=201)
async def create_folder(payload:FolderCreate,user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)]):
 if user.role==UserRole.VIEWER:raise HTTPException(403,"Viewer cannot create folders")
 parent=None
 if payload.parent_id:
  parent=await db.get(Folder,payload.parent_id)
  if not parent:raise HTTPException(404,"Parent folder not found")
  if parent.owner_id!=user.id and user.role!=UserRole.ADMIN and not await db.scalar(select(FolderGrant.id).where(FolderGrant.folder_id==parent.id,FolderGrant.user_id==user.id,FolderGrant.permission=="write")):raise HTTPException(403,"Write access to parent folder required")
 path=(parent.path.rstrip("/")+"/"+parent.name) if parent else ""
 folder=Folder(name=payload.name,parent_id=parent.id if parent else None,owner_id=user.id,path=path or "/")
 db.add(folder);await db.commit();await db.refresh(folder)
 return {"id":str(folder.id),"name":folder.name,"parent_id":str(folder.parent_id) if folder.parent_id else None,"path":folder.path}

@router.put("/{folder_id}/grants")
async def set_grant(folder_id:uuid.UUID,payload:GrantCreate,_:Annotated[User,Depends(admin_user)],db:Annotated[AsyncSession,Depends(get_db)]):
 folder=await db.get(Folder,folder_id)
 if not folder:raise HTTPException(404,"Folder not found")
 if not await db.get(User,payload.user_id):raise HTTPException(404,"User not found")
 grant=await db.scalar(select(FolderGrant).where(FolderGrant.folder_id==folder_id,FolderGrant.user_id==payload.user_id))
 if grant:grant.permission=payload.permission
 else:db.add(FolderGrant(folder_id=folder_id,user_id=payload.user_id,permission=payload.permission))
 await db.commit();return {"folder_id":str(folder_id),"user_id":str(payload.user_id),"permission":payload.permission}

@router.get("/classifications")
async def classifications(user:Annotated[User,Depends(current_user)],db:Annotated[AsyncSession,Depends(get_db)]):
 q=select(Document.classification).where(Document.classification.is_not(None))
 if user.role!=UserRole.ADMIN:
  shared=select(FolderGrant.folder_id).where(FolderGrant.user_id==user.id)
  q=q.where(or_(Document.user_id==user.id,Document.folder_id.in_(shared)))
 vals=(await db.scalars(q.distinct().order_by(Document.classification))).all()
 return [x for x in vals if x]
