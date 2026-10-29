import {describe,it,expect} from 'vitest';
import {boundaryChange} from './boundaryMotion';
const rect={x:100,y:100,w:500,h:400};
describe('shared boundary semantics',()=>{
 it('recognises a top-only pull as yield, but top with another boundary as carrying',()=>{
  expect(boundaryChange(rect,{...rect,y:80,h:420})).toMatchObject({kind:'yield',edges:['top']});
  expect(boundaryChange(rect,{...rect,y:80,w:530,h:420})).toMatchObject({kind:'move',edges:['right','top']});
  expect(boundaryChange(rect,{...rect,y:80})).toMatchObject({kind:'move',edges:['top','bottom']});
 });
 it('preserves both actual sides of a lower corner drag and treats translation as movement',()=>{
  expect(boundaryChange(rect,{...rect,w:530,h:420})).toMatchObject({kind:'yield',edges:['right','bottom']});
  expect(boundaryChange(rect,{...rect,x:80,w:520,h:420})).toMatchObject({kind:'yield',edges:['left','bottom']});
  expect(boundaryChange(rect,{...rect,x:130})).toMatchObject({kind:'move',edges:['left','right']});
 });
});
