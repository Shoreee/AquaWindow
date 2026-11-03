import {describe,expect,it} from 'vitest';
import {peelGeometry,liquidFlapPath} from './peel';
describe('real corner fold with a liquid backside',()=>{
 it('reflects the lifted corner onto the pointer, preserving the original fold',()=>{
  const geometry=peelGeometry(600,500,[600,500],[440,350])!;
  expect(geometry.fold).not.toBeNull();
  expect(geometry.flap.some(([x,y])=>Math.hypot(x-440,y-350)<.0001)).toBe(true);
  expect(geometry.visible.some(([x,y])=>x===600&&y===500)).toBe(false);
 });
 it('keeps all reflected vertices while the free edges ripple',()=>{
  const geometry=peelGeometry(600,500,[0,500],[130,350])!;
  const a=liquidFlapPath(geometry.flap,geometry.fold,0),b=liquidFlapPath(geometry.flap,geometry.fold,.7);
  expect(a).not.toContain('NaN');expect(a).not.toEqual(b);
  for(const [x,y] of geometry.flap)expect(a).toContain(`${x.toFixed(2)} ${y.toFixed(2)}`);
 });
 it('is static when reduced motion disables waves',()=>{
  const geometry=peelGeometry(600,500,[600,500],[440,350])!;
  expect(liquidFlapPath(geometry.flap,geometry.fold,0,0)).toEqual(liquidFlapPath(geometry.flap,geometry.fold,10,0));
 });
});
