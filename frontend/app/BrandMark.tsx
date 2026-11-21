import React from 'react';

const glyphs:Record<string,React.ReactNode>={
 dashboard:<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
 upload:<><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></>,
 archive:<><path d="M4 7.5h16v12H4z"/><path d="M3 4.5h18v3H3zM9 11h6M9 14.5h6"/></>,
 users:<><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.4A4.6 4.6 0 0 1 8.1 13h1.8a4.6 4.6 0 0 1 4.6 4.6V19z"/><path d="M16 5.3a3 3 0 0 1 0 5.6m1 2.2a4 4 0 0 1 3.5 4V19h-3"/></>,
 storage:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/><path d="M8 10h.01M8 17h.01"/></>,
 audit:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
 search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
 arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>
};

export function AppIcon({name,size=20,className=''}:{name:string;size?:number;className?:string}){
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{glyphs[name]||glyphs.archive}</svg>;
}

export default function BrandMark({size=44,compact=false}:{size?:number;compact?:boolean}){
 return <span className={`brand-mark${compact?' brand-mark-compact':''}`} style={{width:size,height:size}} aria-hidden="true"><svg viewBox="0 0 48 48" width={size*.59} height={size*.59} fill="none"><path d="M12 10.5A3.5 3.5 0 0 1 15.5 7h13L36 14v23a3.5 3.5 0 0 1-3.5 3.5h-17A3.5 3.5 0 0 1 12 37V10.5Z" fill="white" fillOpacity=".97"/><path d="M28.5 7v8h7.2M18 22h12M18 27.5h12M18 33h7" stroke="#087DAF" strokeWidth="2.4" strokeLinecap="round"/><path d="m30 33 2.2 2.2 4.8-5" stroke="#00A6A6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
}
