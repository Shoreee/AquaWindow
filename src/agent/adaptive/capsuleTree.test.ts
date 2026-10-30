import {describe,it,expect} from 'vitest';
import {canPutInCapsule,insertCapsuleState,dockCapsuleState,capsuleGraphContains} from './capsuleTree';
import {restoredCapsuleMember} from './capsuleState';
import type {KernelState,WindowState} from '../../kernel/types';
import type {CapsuleSnapshot} from './types';
const normal=(id:string):WindowState=>({id,title:id,appId:'writer',rect:{x:20,y:40,w:500,h:400},form:'normal',depth:0,role:'primary',minimized:false,maximized:false,importance:[],props:{},createdAt:0,lastFocusedAt:0});
const capsule=(id:string,members:WindowState[]):WindowState=>({...normal(id),form:'capsule',capsuleRect:{x:800,y:100,w:180,h:84},props:{agentCapsule:{title:id,members,order:members.map(w=>w.id),focusedId:null,scroll:{}}}});
const state=(...windows:WindowState[]):KernelState=>({windows:Object.fromEntries(windows.map(w=>[w.id,w])),order:windows.map(w=>w.id),focusedId:windows[0].id,screen:{w:1440,h:900},rev:0});
describe('recursive session capsules',()=>{
 it('keeps a nested capsule intact when it is extracted or released',()=>{
  const child=capsule('child',[normal('paper')]),parent=capsule('parent',[normal('note')]),before=state(child,parent);
  const next=insertCapsuleState(before,['child'],'parent')!;
  const snapshot=next.windows.parent.props.agentCapsule as CapsuleSnapshot,nested=snapshot.members.at(-1)!;
  expect(nested.form).toBe('capsule');expect(restoredCapsuleMember(nested,snapshot).form).toBe('capsule');expect(next.windows.child.minimized).toBe(true);
  expect(before.windows.child.minimized).toBe(false);
 });
 it('rejects direct, nested, and title-bar attachment cycles',()=>{
  const child=capsule('child',[normal('paper')]),parent=normal('parent'),s=state(parent,child);
  const docked=dockCapsuleState(s,'child','parent')!;
  expect(capsuleGraphContains(docked,'parent','child')).toBe(true);expect(canPutInCapsule(docked,'parent','child')).toBe(false);
  expect(dockCapsuleState(state(capsule('ancestor',[parent]),parent),'ancestor','parent')).toBeNull();
  expect(insertCapsuleState(s,['child'],'child')).toBeNull();
 });
});
