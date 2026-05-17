import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './Login.css';

function BasketballSVG() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" stroke="white" strokeWidth="2.5" fill="rgba(255,255,255,0.1)" />
      <path d="M24 2C24 2 16 11 16 24s8 22 8 22" stroke="white" strokeWidth="2.5" fill="none" />
      <path d="M24 2C24 2 32 11 32 24s-8 22-8 22" stroke="white" strokeWidth="2.5" fill="none" />
      <path d="M2 24h44" stroke="white" strokeWidth="2.5" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.displayMessage || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">
            <BasketballSVG />
          </div>
          <h1 className="login-brand-name">BallBook</h1>
          <p className="login-brand-tagline">Your personal basketball training platform</p>
        </div>
        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-icon">🏀</span>
            <div>
              <strong>Find Expert Trainers</strong>
              <p>Browse certified basketball coaches near you</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">📅</span>
            <div>
              <strong>Easy Scheduling</strong>
              <p>Book sessions that fit your busy schedule</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">🏆</span>
            <div>
              <strong>Level Up Your Game</strong>
              <p>Specialized training for every skill level</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your BallBook account</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg login-submit-btn"
              disabled={loading}
            >
              {loading ? <><LoadingSpinner size="sm" color="#fff" /> Signing In…</> : 'Sign In'}
            </button>
          </form>

          <div className="login-divider">
            <span>Don't have an account?</span>
          </div>

          <Link to="/register" className="btn btn-outline btn-lg login-register-link">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
