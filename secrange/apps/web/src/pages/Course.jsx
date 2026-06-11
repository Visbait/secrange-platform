import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Course() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null); const [busy, setBusy] = useState(false);

  const load = () => api(`/courses/${slug}`).then(setData).catch(()=>{});
  useEffect(() => { load(); }, [slug]);

  const checkout = async () => {
    setBusy(true);
    try { const { url } = await api('/payments/checkout', { method:'POST', body:{ courseSlug: slug } }); window.location.href = url; }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const toggle = async (moduleId, completed) => {
    await api('/me/progress', { method:'POST', body:{ moduleId, completed } });
    load();
  };
  const launchLab = (mode) => window.open(`/simulator.html#${mode}`, '_blank');

  if (!data) return <div className="center">Loading…</div>;
  const { course, modules, hasAccess, progress } = data;
  const done = Object.values(progress||{}).filter(Boolean).length;
  const pct = modules.length ? Math.round(done/modules.length*100) : 0;

  return (
    <div className="container" style={{paddingTop:24,maxWidth:780}}>
      <div className="body" style={{color:'var(--muted)',fontFamily:'var(--mono)',fontSize:12}}>{course.body}</div>
      <h2 style={{margin:'4px 0'}}>{course.title}</h2>
      <p style={{color:'var(--muted)',marginBottom:16}}>{course.summary}</p>

      {!hasAccess ? (
        <div className="lock">
          <div style={{fontSize:32,marginBottom:8}}>🔒</div>
          <h3>Premium course — ${(course.priceCents/100).toFixed(2)}</h3>
          <p style={{color:'var(--muted)',margin:'8px 0 16px'}}>{modules.length} interactive modules with hands-on labs.</p>
          {user
            ? <button className="btn" onClick={checkout} disabled={busy}>{busy?'Redirecting…':'Buy & unlock'}</button>
            : <a className="btn" href="/login">Sign in to purchase</a>}
        </div>
      ) : (
        <>
          <div className="prog"><div className="f" style={{width:`${pct}%`}}/></div>
          <div className="body" style={{color:'var(--muted)',marginBottom:14}}>{pct}% complete · {done}/{modules.length} modules</div>
          {modules.map((m,i)=>(
            <div key={m.id} className={`module ${progress[m.id]?'done':''}`}>
              <div className="mhead">
                <div className={`mcheck ${progress[m.id]?'on':''}`} onClick={()=>toggle(m.id,!progress[m.id])}>{progress[m.id]?'✓':''}</div>
                <div style={{fontWeight:700}}>{i+1}. {m.title}</div>
              </div>
              <ul className="mpts">{(m.points||[]).map((p,j)=><li key={j}>{p}</li>)}</ul>
              {m.lab_mode && <button className="btn cyan" style={{margin:'10px 0 0 32px'}} onClick={()=>launchLab(m.lab_mode)}>▶ {m.lab_label}</button>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
