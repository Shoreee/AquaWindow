import {createStore} from '../../system/createStore';
let sessionKey='';
export const credentialState=createStore({hasKey:false,revision:0});
/** Session memory only. Never serialize this value or put it into browser storage. */
export function setSessionKey(value:string){sessionKey=value.trim();credentialState.set(s=>({hasKey:!!sessionKey,revision:s.revision+1}));}
export function getSessionKey(){return sessionKey;}
