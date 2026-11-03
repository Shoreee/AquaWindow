const base=import.meta.env.BASE_URL;
/** Prefer the actual OpenHarmony app artwork over generic system-action glyphs. */
export function DesktopAppIcon({id}:{id:string}){
 if(id==='browser')return <span className="desktop-app-icon native-app-icon icon-browser-web"><img src={`${base}browser-icon/browser.svg`} alt=""/></span>;
 const artwork:Record<string,string>={gallery:'gallery.png',writer:'notes.png',chat:'chat-complete.png'};
 if(artwork[id])return <span className={`desktop-app-icon native-app-icon icon-${id}`}><img src={`${base}harmony/${artwork[id]}`} alt=""/></span>;
 const source=id==='finder'?'harmony/folder-notes.svg':id==='experiment'?'system-icons/experiment-filled.svg':`system-icons/${id}.svg`;
 return <span className={`desktop-app-icon icon-${id} harmony-app-tile`}><img src={base+source} alt=""/></span>;
}
