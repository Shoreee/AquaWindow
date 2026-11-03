import {createStore,useStore} from '../system/createStore';
import {kernel} from '../system/kernel';

const questions=[
  {text:'根据方法论，负责理解输入序列并生成特征表示的部分，在架构图中位于哪一侧？',options:['左侧','右侧','最上方','最下方'],answer:0},
  {text:'根据方法论，能够从多个不同表示空间关注信息关系的模块，在编码器的重复结构中位于哪个模块下方？',options:['Input Embedding','Feed Forward','Linear','Softmax'],answer:1},
  {text:'为了避免提前使用未来位置的信息，解码器使用了哪种机制？该模块位于解码器重复结构中的什么位置？',options:['普通多头注意力，顶部','带掩码的多头注意力，底部','前馈神经网络，顶部','位置编码，底部'],answer:1},
  {text:'根据方法论，负责进一步变换每个位置特征的模块，在架构图的哪两个部分都出现了？',options:['仅编码器','仅解码器','编码器和解码器','仅输出层'],answer:2},
  {text:'根据方法论，负责提供词语位置信息的结构，在架构图中与哪两个模块的输出相加？',options:['Input Embedding 和 Output Embedding','Linear 和 Softmax','两个 Feed Forward','两个 Add & Norm'],answer:0},
  {text:'根据方法论，负责将特征转换为词汇概率分布的操作，在架构图中紧接着哪个模块？',options:['Input Embedding','Masked Multi-Head Attention','Linear','Feed Forward'],answer:2},
];
const emptyAnswers=()=>questions.map(()=>null as number|null);
const quizStore=createStore({answers:emptyAnswers(),submitted:false});
const reset=()=>quizStore.set({answers:emptyAnswers(),submitted:false});
kernel.onEvent(event=>{if(event.type==='reset')reset();});

export function TaskOneQuiz(){
  const {answers,submitted}=useStore(quizStore,state=>state);
  const answered=answers.filter(answer=>answer!==null).length;
  const score=answers.filter((answer,index)=>answer===questions[index].answer).length;
  return <section className="study-quiz" aria-label="Transformer 图文理解测试">
    <h3>Transformer 图文理解测试</h3>
    <p>6 道单选题 · 建议限时 5–7 分钟</p>
    <p className="study-quiz-progress" aria-live="polite">{answered}/6 已答</p>
    <form onSubmit={event=>{event.preventDefault();if(answered===questions.length)quizStore.set({submitted:true});}}>
      {questions.map((question,index)=><fieldset key={question.text} disabled={submitted}>
        <legend>{index+1}. {question.text}</legend>
        {question.options.map((option,choice)=><label key={option} className={answers[index]===choice?'selected':''}>
          <input type="radio" name={`task-one-question-${index}`} value={choice} checked={answers[index]===choice} onChange={()=>{const next=[...answers];next[index]=choice;quizStore.set({answers:next});}}/>
          <span>{String.fromCharCode(65+choice)}. {option}</span>
        </label>)}
        {submitted&&<p className="study-quiz-feedback">{answers[index]===question.answer?'回答正确':`回答错误 · 正确答案：${String.fromCharCode(65+question.answer)}`}</p>}
      </fieldset>)}
      {submitted&&<p className="study-quiz-result" role="status">成绩：{score}/6 题正确</p>}
      <div className="study-quiz-actions">
        <button type="submit" disabled={answered!==questions.length||submitted}>提交并查看成绩</button>
        <button type="button" onClick={reset}>重做</button>
      </div>
    </form>
  </section>;
}
