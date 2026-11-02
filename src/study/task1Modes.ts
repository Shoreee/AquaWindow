export const TASK1_MODES = [
  {id:'parallel',label:'并列呈现'},
  {id:'primary-secondary',label:'主次呈现'},
  {id:'local-hole',label:'中央揭示'},
  {id:'local-layer',label:'穿透'},
] as const;

export function isTask1Layout(mode:string){
  return mode==='parallel'||mode==='primary-secondary';
}

// The order describes the supplied materials; these identities stay hidden in the UI.
export function task1CandidateIds(mode:string,taskId='task1'):string[]{
  return mode==='parallel'
    ? [`${taskId}-a`,`${taskId}-b`,`${taskId}-c`]
    : [`${taskId}-a`,`${taskId}-b`,`${taskId}-c`,`${taskId}-d`];
}
