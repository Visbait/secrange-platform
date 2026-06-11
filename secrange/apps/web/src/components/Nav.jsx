import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="nav">
      <Link className="brand" to="/"><span className="logo">&gt;_</span> SecRange</Link>
      <div className="nav-links">
        <Link to="/catalog">Courses</Link>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profile</Link>
            <button className="btn ghost" onClick={async()=>{await logout();nav('/');}}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link className="btn" to="/register">Start free</Link>
          </>
        )}
      </div>
    </div>
  );
}
