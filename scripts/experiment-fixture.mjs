// Other suites isolate formal tasks; experiment-onboarding-e2e covers all real prerequisite operations.
export async function admitTestParticipant(page){
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(entry=>entry.name.includes('/study/onboarding.ts'))?.name;
  if(!url)throw new Error('Onboarding module not loaded');
  const {registerParticipant,onboarding,learningQuestions}=await import(url);
  registerParticipant('自动测试','P01');
  onboarding.set({stage:'ready',records:learningQuestions.map(q=>({mode:q.mode,seconds:1,attempts:1,passedAt:new Date().toISOString()}))});
 });
}
