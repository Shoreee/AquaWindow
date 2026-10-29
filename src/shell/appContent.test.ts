import {describe,it,expect} from 'vitest';
import {WindowKernel} from '../kernel/kernel';
import {sameAppContent} from './appContent';
function window(){const k=new WindowKernel();const id=k.open({appId:'finder',title:'files',rect:{x:10,y:20,w:550,h:400},props:{path:'Downloads',query:'paper'}});return k.get(id);}
describe('document render isolation',()=>{
 it('retains an application while its shell moves, deforms and carries feedback',()=>{
  const w=window();
  expect(sameAppContent(w,{...w,rect:{...w.rect,x:400,w:410},depth:.3,props:{...w.props,agentMotion:{action:.5},agentView:{revealed:true},agentQueue:{amount:.4},agentDivision:{amount:.5}}})).toBe(true);
 });
 it('keeps document changes, grouping, navigation and app replacement live',()=>{
  const w=window();
  for(const props of [{...w.props,query:'new'},{...w.props,path:'Desktop'},{...w.props,agentGrouping:true},{path:'Downloads'}])expect(sameAppContent(w,{...w,props})).toBe(false);
  expect(sameAppContent(w,{...w,title:'renamed'})).toBe(false);
  expect(sameAppContent(w,{...w,appId:'preview'})).toBe(false);
  expect(sameAppContent(w,{...w,group:'trail-1'})).toBe(false);
 });
});
