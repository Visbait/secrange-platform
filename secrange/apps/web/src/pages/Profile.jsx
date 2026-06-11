import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);

  useEffect(() => {
    api('/me/profile').then(setData).catch(e => setErr(e.message || 'Could not load profile'));
  }, []);

  const openBilling = async () => {
    setBillingBusy(true);
    try { const { url } = await api('/payments/portal'); window.location.href = url; }
    catch (e) { alert(e.message); } finally { setBillingBusy(false); }
  };

  if (err) return <div className="center">{err}</div>;
  if (!data) return <div className="center">Loading your profile…</div>;

  const { account, completed, inProgress, billing, stats, recommendations } = data;
  const memberSince = new Date(account.memberSince).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const initials = (account.displayName || account.email).slice(0, 2).toUpperCase();

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 860 }}>

      {/* Identity header */}
      <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 20 }}>
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 2 }}>{account.displayName}</h2>
          <div className="muted-mono">{account.email}</div>
          <div className="muted-mono" style={{ marginTop: 4 }}>
            {account.role} · member since {memberSince}
            {account.emailVerified
              ? <span className="bdg free" style={{ marginLeft: 8 }}>Verified</span>
              : <span className="bdg prem" style={{ marginLeft: 8 }}>Unverified</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat"><div className="k">XP</div><div className="v">{stats.xp}</div></div>
        <div className="stat"><div className="k">Level</div><div className="v">{stats.level}</div></div>
        <div className="stat"><div className="k">Courses done</div><div className="v">{completed.length}</div></div>
        <div className="stat"><div className="k">Labs done</div><div className="v">{stats.labs_done}</div></div>
      </div>

      {/* Subscription / billing */}
      <div className="section-title">Subscription &amp; billing</div>
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="billrow">
          <span>Courses you own</span><b>{billing.activeEntitlements}</b>
        </div>
        <div className="billrow">
          <span>Purchased</span><b>{billing.purchasedCourses}</b>
        </div>
        <div className="billrow">
          <span>Free / included</span><b>{billing.freeCourses}</b>
        </div>
        <div style={{ marginTop: 14 }}>
          {billing.hasStripeCustomer
            ? <button className="btn ghost" onClick={openBilling} disabled={billingBusy}>
                {billingBusy ? 'Opening…' : 'Manage billing & receipts'}
              </button>
            : <Link className="btn ghost" to="/catalog">Browse premium courses →</Link>}
        </div>
      </div>

      {/* Recommendations — path to security engineer */}
      <div className="section-title">Your path to security engineer</div>
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="recohead">{recommendations.headline}</div>
        <div className="prog"><div className="f" style={{ width: `${Math.round(recommendations.roadmapDone / recommendations.roadmapTotal * 100)}%` }} /></div>
        <div className="muted-mono" style={{ marginBottom: 12 }}>
          {recommendations.roadmapDone} of {recommendations.roadmapTotal} roadmap steps complete
        </div>
        {[...recommendations.nextSteps, ...recommendations.stretch].length === 0
          ? <p className="muted-mono">You're all caught up. Nice work.</p>
          : [...recommendations.nextSteps, ...recommendations.stretch].map(r => (
              <Link key={r.slug} to={`/course/${r.slug}`} className="reco">
                <div className="reco-stage">{r.stage}</div>
                <div className="reco-title">{r.title}</div>
                <div className="reco-why">{r.why}</div>
                <div className="badges" style={{ marginTop: 6 }}>
                  <span className="bdg">{r.tier?.toUpperCase()}</span>
                  {r.isFree ? <span className="bdg free">Free</span> : <span className="bdg prem">${(r.priceCents / 100).toFixed(0)}</span>}
                </div>
              </Link>
            ))}
      </div>

      {/* Completed courses */}
      <div className="section-title">Completed courses</div>
      {completed.length === 0
        ? <p className="muted-mono" style={{ marginBottom: 10 }}>No completed courses yet — finish a course to see it here.</p>
        : <div className="grid">
            {completed.map(c => (
              <Link key={c.id} className="ccard" to={`/course/${c.slug}`} style={{ color: 'var(--text)' }}>
                <h3>{c.title} <span className="bdg free">✓ Done</span></h3>
                <div className="body">{c.body}</div>
                <div className="prog"><div className="f" style={{ width: '100%' }} /></div>
                <div className="body">{c.done}/{c.modules} modules</div>
              </Link>
            ))}
          </div>}

      {/* In-progress courses */}
      <div className="section-title">In progress</div>
      {inProgress.length === 0
        ? <p className="muted-mono">Nothing in progress. <Link to="/catalog">Find a course →</Link></p>
        : <div className="grid">
            {inProgress.map(c => (
              <Link key={c.id} className="ccard" to={`/course/${c.slug}`} style={{ color: 'var(--text)' }}>
                <h3>{c.title}</h3>
                <div className="body">{c.body}</div>
                <div className="prog"><div className="f" style={{ width: `${c.percent}%` }} /></div>
                <div className="body">{c.percent}% · {c.done}/{c.modules} modules</div>
              </Link>
            ))}
          </div>}
    </div>
  );
}
