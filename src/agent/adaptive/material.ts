import {createStore} from '../../system/createStore';
export const materialActivity=createStore({active:false,targets:[] as string[],startedAt:0,serial:0});
export function beginMaterial(targets:string[]){materialActivity.set(s=>({active:true,targets,startedAt:performance.now(),serial:s.serial+1}));}
export function endMaterial(){materialActivity.set({active:false,targets:[]});}
