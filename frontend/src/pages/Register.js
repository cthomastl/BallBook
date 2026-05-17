import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './Login.css';
import './Register.css';

const SPECIALIZATIONS = ['Shooting', 'Defense', 'Dribbling', 'Conditioning', 'General'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'trainee',
    specialization: '',
    bio: '',
    hourly_rate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTrainer = form.role === 'trainer';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isTrainer && !form.specialization) {
      setError('Please select a specialization.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      };
      if (isTrainer) {
        payload.specialization = form.specialization;
        if (form.bio.trim()) payload.bio = form.bio.trim();
        if (form.hourly_rate) payload.hourly_rate = parseFloat(form.hourly_rate);
      }
      await register(payload);
      navigate('/');
    } catch (err) {
      setError(err.displayMessage || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page register-page">
      {/* Reuse left panel from Login */}
      <div className="login-left register-left">
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="white" strokeWidth="2.5" fill="rgba(255,255,255,0.1)" />
              <path d="M24 2C24 2 16 11 16 24s8 22 8 22" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M24 2C24 2 32 11 32 24s-8 22-8 22" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M2 24h44" stroke="white" strokeWidth="2.5" />
            </svg>
          </div>
          <h1 className="login-brand-name">BallBook</h1>
          <p className="login-brand-tagline">Join the premier basketball training platform</p>
        </div>
        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-icon">🎯</span>
            <div>
              <strong>For Trainees</strong>
              <p>Find and book personalized sessions with top coaches</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">📈</span>
            <div>
              <strong>For Trainers</strong>
              <p>Grow your coaching business and manage your schedule</p>
            </div>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon">🔒</span>
            <div>
              <strong>Safe &amp; Secure</strong>
              <p>Your data and payments are always protected</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right register-right">
        <div className="login-card register-card">
          <div className="login-card-header">
            <h2>Create Account</h2>
            <p>Join BallBook and start your journey</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full Name <span className="required">*</span></label>
              <input
                id="reg-name"
                name="name"
                type="text"
                className="form-input"
                placeholder="John Smith"
                value={form.name}
                onChange={handleChange}
                autoFocus
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address <span className="required">*</span></label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password <span className="required">*</span></label>
              <input
                id="reg-password"
                name="password"
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            {/* Role */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">I am a… <span className="required">*</span></label>
              <select
                id="reg-role"
                name="role"
                className="form-select"
                value={form.role}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="trainee">Trainee (looking for a coach)</option>
                <option value="trainer">Trainer (offering sessions)</option>
              </select>
            </div>

            {/* Trainer-only fields */}
            {isTrainer && (
              <div className="register-trainer-section">
                <div className="register-trainer-divider">
                  <span>Trainer Details</span>
                </div>

                {/* Specialization */}
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-spec">Specialization <span className="required">*</span></label>
                  <select
                    id="reg-spec"
                    name="specialization"
                    className="form-select"
                    value={form.specialization}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select your specialization…</option>
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Hourly Rate */}
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-rate">Hourly Rate (USD)</label>
                  <div className="register-rate-input">
                    <span className="register-rate-prefix">$</span>
                    <input
                      id="reg-rate"
                      name="hourly_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input register-rate-field"
                      placeholder="75.00"
                      value={form.hourly_rate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-bio">Bio</label>
                  <textarea
                    id="reg-bio"
                    name="bio"
                    className="form-textarea"
                    placeholder="Tell trainees about your experience, coaching style, and achievements…"
                    value={form.bio}
                    onChange={handleChange}
                    rows={4}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg login-submit-btn"
              disabled={loading}
            >
              {loading ? <><LoadingSpinner size="sm" color="#fff" /> Creating Account…</> : 'Create Account'}
            </button>
          </form>

          <div className="login-divider">
            <span>Already have an account?</span>
          </div>
          <Link to="/login" className="btn btn-outline btn-lg login-register-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
