import { Link } from 'react-router-dom';
export default function Landing() {
  return (
    <div className="container">
      <div className="hero">
        <h1>Learn security by <span className="hl">doing the job</span>.</h1>
        <p>SecRange turns certification prep into hands-on labs — triage real alerts, write detections,
           analyze packet captures, and run full incident response. Track your progress, level up, get certified.</p>
        <div className="cta">
          <Link className="btn" to="/register">Start free</Link>
          <Link className="btn ghost" to="/catalog">Browse courses</Link>
        </div>
      </div>
      <div className="features">
        <div className="feature"><div className="ic">🧪</div><h3>Real labs, not slides</h3><p>Every module ends in an interactive lab built from a live SOC simulator.</p></div>
        <div className="feature"><div className="ic">📈</div><h3>Tracked progress</h3><p>XP, streaks, and per-course completion synced to your account.</p></div>
        <div className="feature"><div className="ic">🎯</div><h3>Mapped to exams</h3><p>Courses align to Security+, CySA+, SC-200, BTL1 and more — domain by domain.</p></div>
      </div>
    </div>
  );
}
