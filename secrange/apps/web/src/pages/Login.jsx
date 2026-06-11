import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(email, password); nav('/dashboard'); }
    catch (e) { setErr(e.message || 'Login failed'); } finally { setBusy(false); }
  };
  return (
    <div className="container"><div className="authwrap card">
      <h2 style={{marginBottom:16}}>Sign in</h2>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
        {err && <div className="err">{err}</div>}
        <button className="btn" style={{width:'100%'}} disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
      </form>
      <p style={{marginTop:14,fontSize:13,color:'var(--muted)'}}>No account? <Link to="/register">Create one</Link></p>
    </div></div>
  );
}
