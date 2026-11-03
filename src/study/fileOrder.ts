/** Repeatable placement per participant and task, independent of presentation mode. */
export function fileCandidateOrder(task:string,participant:string){
 let seed=2166136261;
 for(const ch of `${participant.trim()||'P01'}:${task}`)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 const ids=['a','b','c','d'].map(letter=>`${task}-${letter}`);
 for(let i=ids.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 return ids;
}
