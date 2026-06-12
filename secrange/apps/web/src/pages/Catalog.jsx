import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const CATS = [['all','All'],['entry','Entry'],['blue','Blue / SOC'],['cloud','Cloud'],['red','Red Team'],['forensics','Forensics & IR'],['grc','GRC / Leadership']];

export default function Catalog() {
  const [courses, setCourses] = useState([]); const [cat, setCat] = useState('all');
  const [q, setQ] = useState(''); const nav = useNavigate();
  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat !== 'all') qs.set('category', cat);
    if (q) qs.set('q', q);
    api(`/courses?${qs}`).then(d => setCourses(d.courses)).catch(()=>{});
  }, [cat, q]);
  return (
    <div className="container" style={{paddingTop:24}}>
      <h2 style={{marginBottom:14}}>Course catalog</h2>
      <input className="field" style={{width:'100%',padding:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,color:'var(--text)',marginBottom:12}}
             placeholder="Search certifications…" value={q} onChange={e=>setQ(e.target.value)} />
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}>
        {CATS.map(([id,label])=>(
          <button key={id} onClick={()=>setCat(id)}
            className="btn ghost" style={cat===id?{borderColor:'var(--gold)',color:'var(--gold)'}:{}}>{label}</button>
        ))}
      </div>
      <div className="grid">
        {courses.map(c=>(
          <div key={c.id} className="ccard" onClick={()=>nav(`/course/${c.slug}`)}>
            <h3>{c.title}</h3>
            <div className="body">{c.body} · {c.costLabel} · {c.estTime}</div>
            <div className="badges">
              <span className="bdg">{c.tier.toUpperCase()}</span>
              {c.isFree ? <span className="bdg free">Free</span> : <span className="bdg prem">${(c.priceCents/100).toFixed(0)}</span>}
              <span className="bdg lab">Interactive labs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
