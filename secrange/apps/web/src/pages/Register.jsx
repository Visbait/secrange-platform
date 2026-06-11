import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await register(email, password, name); nav('/dashboard'); }
    catch (e) { setErr(e.message || 'Registration failed'); } finally { setBusy(false); }
  };
  return (
    <div className="container"><div className="authwrap card">
      <h2 style={{marginBottom:16}}>Create your account</h2>
      <form onSubmit={submit}>
        <div className="field"><label>Display name</label><input value={name} onChange={e=>setName(e.target.value)} required/></div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="field"><label>Password (min 10 chars)</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={10}/></div>
        {err && <div className="err">{err}</div>}
        <button className="btn" style={{width:'100%'}} disabled={busy}>{busy?'Creating…':'Create account'}</button>
      </form>
      <p style={{marginTop:14,fontSize:13,color:'var(--muted)'}}>Already have an account? <Link to="/login">Sign in</Link></p>
    </div></div>
  );
}
