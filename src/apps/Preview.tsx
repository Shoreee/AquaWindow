import type { WindowState } from '../kernel/types';
import { paperById, type Paper } from './data/papers';

function Figure({ kind }: { kind: Paper['figure'] }) {
  switch (kind) {
    case 'bars':
      return (
        <svg viewBox="0 0 300 110" preserveAspectRatio="xMidYMid meet">
          {[
            ['Overlapping', 96, '#c9d3e3'],
            ['Tiling', 82, '#9fb4d6'],
            ['Foveated', 68, '#3a7bff'],
          ].map(([l, v, c], i) => (
            <g key={String(l)}>
              <rect x={40 + i * 85} y={100 - Number(v)} width="50" height={Number(v)} rx="4" fill={String(c)} />
              <text x={65 + i * 85} y={96 - Number(v)} fontSize="9" textAnchor="middle" fill="#334">
                {[57.9, 49.3, 41.2][i]}s
              </text>
              <text x={65 + i * 85} y="109" fontSize="8" textAnchor="middle" fill="#667">
                {String(l)}
              </text>
            </g>
          ))}
        </svg>
      );
    case 'field':
      return (
        <svg viewBox="0 0 300 110">
          <defs>
            <filter id="goo">
              <feGaussianBlur stdDeviation="7" />
              <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
            </filter>
          </defs>
          <g filter="url(#goo)" fill="#6a8dff">
            <rect x="50" y="20" width="90" height="70" rx="18" />
            <rect x="135" y="30" width="110" height="60" rx="18" />
          </g>
        </svg>
      );
    case 'timeline':
      return (
        <svg viewBox="0 0 300 110">
          {Array.from({ length: 34 }, (_, i) => (
            <rect key={i} x={10 + i * 8.3} y={100 - ((i * 37) % 70) - 10} width="5" height={((i * 37) % 70) + 10} rx="2" fill={i % 5 === 0 ? '#ff8a3d' : '#7aa2ff'} />
          ))}
        </svg>
      );
    case 'scatter':
      return (
        <svg viewBox="0 0 300 110">
          {Array.from({ length: 60 }, (_, i) => {
            const x = 20 + ((i * 53) % 260);
            const y = 100 - (((i * 29) % 80) + (x / 260) * 10);
            return <circle key={i} cx={x} cy={y} r="3" fill={i % 3 ? '#3a7bff' : '#ff6a3d'} opacity=".75" />;
          })}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 300 110">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={70 + i * 14} y={16 + i * 9} width={150 - i * 14} height={70 - i * 8} rx="10" fill="#7aa2ff" opacity={1 - i * 0.2} stroke="#fff" />
          ))}
        </svg>
      );
  }
}

export default function Preview({ win, peripheral }: { win: WindowState; peripheral?: boolean }) {
  const p = paperById(String(win.props.paperId ?? ''));
  if (peripheral)
    return (
      <div className="pv-peri">
        <b>{p.title}</b>
        <div className="pv-table mini">
          <table>
            <thead>
              <tr>{p.table.head.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {p.table.rows.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  return (
    <div className="pv">
      <div className="pv-page">
        <div className="pv-head">
          <div className="pv-venue">{p.venue} · {p.id}</div>
          <h1>{p.title}</h1>
          <div className="pv-auth">{p.authors}</div>
        </div>
        <div className="pv-abs">
          <b>Abstract.</b> {p.abstract}
        </div>
        <figure className="pv-fig">
          <Figure kind={p.figure} />
          <figcaption>{p.figureCaption}</figcaption>
        </figure>
        <div className="pv-table">
          <div className="cap">{p.table.caption}</div>
          <table>
            <thead>
              <tr>{p.table.head.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {p.table.rows.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
