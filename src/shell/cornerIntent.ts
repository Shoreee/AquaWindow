export type Corner=[number,number];
export function cornerMetrics(width:number,height:number){
 const short=Math.min(width,height);
 return {radius:Math.max(14,Math.min(38,short*.13)),preview:Math.min(12,short*.03),inset:8};
}
/** Inner corner = peel; the outer border remains exclusively a resize target. */
export function cornerIntent(x:number,y:number,width:number,height:number){
 const metrics=cornerMetrics(width,height);
 const corners:Corner[]=[[0,0],[width,0],[width,height],[0,height]];
 const corner=corners.find(([cx,cy])=>Math.hypot(x-cx,y-cy)<=metrics.radius);
 if(!corner)return {kind:'none' as const,corner:null};
 const dx=Math.abs(x-corner[0]),dy=Math.abs(y-corner[1]);
 if(x<0||y<0||x>width||y>height||dx<metrics.inset||dy<metrics.inset)return {kind:'resize' as const,corner};
 if(width<100||height<80)return {kind:'none' as const,corner:null};
 return {kind:'peel' as const,corner};
}
