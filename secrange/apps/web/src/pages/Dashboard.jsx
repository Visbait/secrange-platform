import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => { api('/me/dashboard').then(setData).catch(()=>{}); }, []);
  if (!data) return <div className="center">Loading…</div>;
  const { courses, stats } = data;
  return (
    <div className="container" style={{paddingTop:24}}>
      <h2 style={{marginBottom:16}}>Welcome back, {user?.displayName}</h2>
      <div className="stat-row">
        <div className="stat"><div className="k">XP</div><div className="v">{stats.xp}</div></div>
        <div className="stat"><div className="k">Level</div><div className="v">{stats.level}</div></div>
        <div className="stat"><div className="k">Best streak</div><div className="v">{stats.best_streak}</div></div>
        <div className="stat"><div className="k">Labs done</div><div className="v">{stats.labs_done}</div></div>
      </div>
      <div className="section-title">Your courses</div>
      {courses.length === 0
        ? <p style={{color:'var(--muted)'}}>No courses yet. <Link to="/catalog">Browse the catalog →</Link></p>
        : <div className="grid">
            {courses.map(c=>(
              <Link key={c.id} className="ccard" to={`/course/${c.slug}`} style={{color:'var(--text)'}}>
                <h3>{c.title}</h3>
                <div className="body">{c.body}</div>
                <div className="prog"><div className="f" style={{width:`${c.percent}%`}}/></div>
                <div className="body">{c.percent}% · {c.done}/{c.modules} modules</div>
              </Link>
            ))}
          </div>}
    </div>
  );
}
