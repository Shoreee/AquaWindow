import type {Rect} from '../../kernel/types';
import type {Edge} from './types';
export interface BoundaryChange{kind:'move'|'yield';edges:Edge[];deltas:Record<Edge,number>}
/** A top-only pull is a resize. A moving top plus any other edge carries the window. */
export function boundaryChange(from:Rect,to:Rect):BoundaryChange{
 const deltas={left:to.x-from.x,right:to.x+to.w-from.x-from.w,top:to.y-from.y,bottom:to.y+to.h-from.y-from.h};
 const edges=(Object.keys(deltas) as Edge[]).filter(edge=>Math.abs(deltas[edge])>.1);
 const translated=Math.abs(to.w-from.w)<.1&&Math.abs(to.h-from.h)<.1&&edges.length>0;
 const kind=translated||edges.includes('top')&&edges.length>1?'move':'yield';
 return {kind,edges,deltas};
}
