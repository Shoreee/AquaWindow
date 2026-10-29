import type {Rect} from '../../kernel/types';
export function capsuleSize(count:number){return {w:Math.min(310,128+Math.max(1,count)*38),h:76+Math.min(Math.max(1,count),5)*4};}
export function capsuleOverstretch(rect:Rect,count:number){const n=capsuleSize(count);return Math.max(rect.w/(n.w*1.75),rect.h/(n.h*2.0),Math.sqrt(rect.w*rect.h/(n.w*n.h*2.4)));}
