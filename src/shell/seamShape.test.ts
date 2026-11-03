import {expect,it} from 'vitest';
import {seamGeometry} from './surfaceBondGeometry';
import {seamOffset,seamOpening,seamPath} from './seamShape';
const g=seamGeometry({x:0,y:0,w:400,h:500},{x:404,y:0,w:400,h:500},'x');
it('starts fully joined and ends fully open from either endpoint',()=>{
 for(const fromEnd of [false,true])for(const t of [0,.1,.5,.9,1]){
  expect(seamOpening(t,g.length,{progress:0,fromEnd})).toBe(0);
  expect(seamOpening(t,g.length,{progress:1,fromEnd})).toBe(1);
 }
});
it('never moves either native contour while closed, including offset seam endpoints',()=>{
 for(const axis of ['x','y'] as const){
  const offset=seamGeometry({x:30,y:40,w:450,h:500},{x:484,y:15,w:450,h:500},axis);
  for(const t of [-.1,0,.2,.6,1,1.1])for(const first of [true,false]){
   expect(seamOffset(offset,first,t,1,null)).toBe(0);
   expect(seamOffset(offset,first,t,1,{progress:0,fromEnd:false})).toBe(0);
  }
 }
});
it('opens behind the zipper and keeps ahead of it joined',()=>{
 expect(seamOpening(.2,g.length,{progress:.5,fromEnd:false})).toBe(1);
 expect(seamOpening(.8,g.length,{progress:.5,fromEnd:false})).toBe(0);
 expect(seamOpening(.8,g.length,{progress:.5,fromEnd:true})).toBe(1);
 expect(seamOpening(.2,g.length,{progress:.5,fromEnd:true})).toBe(0);
});
it('returns both edges to their native positions at the end of release',()=>{
 for(const t of [0,.4,1])for(const first of [false,true])expect(seamOffset(g,first,t,1,{progress:1,fromEnd:false,release:1})).toBe(0);
 expect(seamPath(g,true,0,1,1,{progress:.5,fromEnd:false})).not.toContain('NaN');
});
