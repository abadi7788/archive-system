'use client';
import { useId, type DragEvent } from 'react';
import { AppIcon } from '../BrandMark';

/** Layered Windows-style silhouette, colored entirely by the current system theme. */
export function FolderIcon() {
  const id = useId().replace(/:/g, '');
  return <svg className="system-folder-icon" viewBox="0 0 96 76" fill="none" aria-hidden="true" focusable="false" data-folder-shape="layered">
    <defs>
      <linearGradient id={`${id}-back`} x1="48" y1="5" x2="48" y2="69" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--folder-back-start)" /><stop offset="1" stopColor="var(--folder-back-end)" />
      </linearGradient>
      <linearGradient id={`${id}-front`} x1="48" y1="22" x2="48" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--folder-front-start)" /><stop offset="1" stopColor="var(--folder-front-end)" />
      </linearGradient>
    </defs>
    <path d="M5 13C5 8.58 8.58 5 13 5H33.2C35.4 5 37.5 5.9 39 7.5L44.1 13H83C87.42 13 91 16.58 91 21V61C91 65.42 87.42 69 83 69H13C8.58 69 5 65.42 5 61V13Z" fill={`url(#${id}-back)`} />
    <path d="M6 24C6 21.79 7.79 20 10 20H86C88.21 20 90 21.79 90 24V60H6V24Z" fill="white" fillOpacity=".14" />
    <path d="M4 29C4 24.58 7.58 21 12 21H84C88.42 21 92 24.58 92 29V62C92 66.42 88.42 70 84 70H12C7.58 70 4 66.42 4 62V29Z" fill={`url(#${id}-front)`} />
    <path d="M5.5 29C5.5 25.41 8.41 22.5 12 22.5H84C87.59 22.5 90.5 25.41 90.5 29" stroke="white" strokeOpacity=".38" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12 69H84" stroke="var(--folder-back-end)" strokeOpacity=".2" strokeLinecap="round" />
  </svg>;
}

export default function FolderTile({ name, subtitle, detail, renameLabel, deleteLabel, onOpen, onRename, onDelete,
  dropActive = false, onDragOver, onDragLeave, onDrop }: {
  name: string; subtitle: string; detail?: string; renameLabel?: string; deleteLabel?: string;
  onOpen: () => void; onRename?: () => void; onDelete?: () => void; dropActive?: boolean;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return <div role="listitem" className="folder-tile" data-drop-active={dropActive || undefined}
    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    onContextMenu={event => { if (onRename) { event.preventDefault(); onRename(); } }}>
    <button type="button" className="folder-tile-open" aria-label={name} onClick={onOpen}>
      <FolderIcon />
      <span className="folder-tile-name" dir="auto" title={name}>{name}</span>
      <span className="folder-tile-count">{subtitle}</span>
      {detail && <span className="folder-tile-detail">{detail}</span>}
    </button>
    {(onRename || onDelete) && <div className="folder-tile-actions">
      {onRename && <button type="button" onClick={onRename} title={renameLabel} aria-label={`${renameLabel}: ${name}`}><AppIcon name="edit" size={15} /></button>}
      {onDelete && <button type="button" onClick={onDelete} title={deleteLabel} aria-label={`${deleteLabel}: ${name}`} className="folder-tile-delete"><AppIcon name="trash" size={15} /></button>}
    </div>}
  </div>;
}
