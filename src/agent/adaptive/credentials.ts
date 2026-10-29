import {createStore} from '../../system/createStore';
let sessionKey='';
export const credentialState=createStore({hasKey:false});
/** Session memory only. Never serialize this value or put it into browser storage. */
export function setSessionKey(value:string){sessionKey=value.trim();credentialState.set({hasKey:!!sessionKey});}
export function getSessionKey(){return sessionKey;}
