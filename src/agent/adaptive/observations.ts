/** Application-owned observations, not DOM scraping or inferred task answers. */
export interface AppObservation {kind?:'pdf'|'note'|'file-list'|'gallery'|'web'|'image'|'chat';availability?:'content'|'metadata-only'|'empty'|'loading';title:string;text?:string;documentId?:string;page?:number;scroll?:number;editable?:boolean;selection?:string}
const observations=new Map<string,AppObservation>();
export function observeApp(id:string,patch:Partial<AppObservation>){observations.set(id,{title:'',...observations.get(id),...patch});}
export function appObservation(id:string){return observations.get(id);}
export function forgetObservations(ids?:Set<string>){for(const id of observations.keys())if(!ids||!ids.has(id))observations.delete(id);}
