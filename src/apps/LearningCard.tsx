import type {WindowState} from '../kernel/types';
export default function LearningCard({win}:{win:WindowState}){
 return <div className="learning-card">{win.props.cover?<p>这是一份正在阅读的材料。</p>:<div className="learning-card-code"><span>参考编号</span><strong>{String(win.props.code??'')}</strong></div>}</div>;
}
