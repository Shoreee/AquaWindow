import {useState} from 'react';
import {log} from './logger';

const questions=[
  {text:'对照论文架构图，实验示例回答中哪一句不准确？',options:[
    '图左侧是编码器，右侧是解码器。',
    '编码器和解码器都包含带掩码的多头注意力。',
    'Linear 后接 Softmax，输出词汇概率。',
  ],correct:1},
  {text:'哪处图像证据可以判断这句话？',options:[
    '图中只有解码器底部标有 Masked Multi-Head Attention。',
    '图中编码器和解码器都有 Feed Forward。',
    '图中最上方是 Output Probabilities。',
  ],correct:0},
];

export function TaskFiveQuiz({imageSent,onSubmitted}:{imageSent:boolean;onSubmitted:(done:boolean)=>void}){
  const [answers,setAnswers]=useState<(number|null)[]>([null,null]);
  const [submitted,setSubmitted]=useState(false);
  return <section className="study-quiz" aria-label="图像问答核对">
    <h3>图像问答核对</h3>
    {!imageSent?<p className="study-quiz-progress">将图 1 的截图附到 AI 问答并发送后作答。</p>:<form onSubmit={event=>{
      event.preventDefault();if(answers.some(answer=>answer===null))return;
      setSubmitted(true);onSubmitted(true);
      const score=answers.filter((answer,index)=>answer===questions[index].correct).length;
      log({src:'study',type:'qa.image.quiz.submit',data:{answers,score,total:questions.length}});
    }}>
      {questions.map((question,questionIndex)=><fieldset key={question.text} disabled={submitted}>
        <legend>{questionIndex+1}. {question.text}</legend>
        {question.options.map((option,index)=><label key={option} className={answers[questionIndex]===index?'selected':''}>
          <input type="radio" name={`qa-image-check-${questionIndex}`} checked={answers[questionIndex]===index} onChange={()=>setAnswers(current=>current.map((value,at)=>at===questionIndex?index:value))}/><span>{String.fromCharCode(65+index)}. {option}</span>
        </label>)}
      </fieldset>)}
      {submitted&&<p className="study-quiz-result" role="status">成绩：{answers.filter((answer,index)=>answer===questions[index].correct).length}/{questions.length} 题正确</p>}
      <div className="study-quiz-actions"><button type="submit" disabled={answers.some(answer=>answer===null)||submitted}>提交答案</button><button type="button" onClick={()=>{setAnswers([null,null]);setSubmitted(false);onSubmitted(false);}}>重做</button></div>
    </form>}
  </section>;
}
