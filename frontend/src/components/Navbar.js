import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function BasketballIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.8"/>
      <path d="M12 2C12 2 8 6 8 12s4 10 4 10" stroke="white" strokeWidth="1.8" fill="none"/>
      <path d="M12 2C12 2 16 6 16 12s-4 10-4 10" stroke="white" strokeWidth="1.8" fill="none"/>
      <path d="M2 12h20" stroke="white" strokeWidth="1.8"/>
    </svg>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    setMobileOpen(false);
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [navigate]);

  const isTrainer = user?.role === 'trainer';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          {/* Logo */}
          <Link to="/" className="navbar-logo">
            <div className="navbar-logo-icon">
              <BasketballIcon />
            </div>
            <span className="navbar-logo-text">
              <span>Ball</span>Book
            </span>
          </Link>

          {/* Desktop Nav Links */}
          {isAuthenticated && (
            <ul className="navbar-links">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
                >
                  Home
                </NavLink>
              </li>
              {!isTrainer && (
                <li>
                  <NavLink
                    to="/my-bookings"
                    className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
                  >
                    My Bookings
                  </NavLink>
                </li>
              )}
            </ul>
          )}

          {/* Right Side */}
          <div className="navbar-right">
            {isAuthenticated ? (
              <>
                {/* Mobile menu button */}
                <button
                  className="navbar-menu-btn"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? '✕' : '☰'}
                </button>

                {/* User Menu */}
                <div className="user-menu" ref={dropdownRef}>
                  <button
                    className="user-menu-trigger"
                    onClick={() => setDropdownOpen((v) => !v)}
                    aria-expanded={dropdownOpen}
                  >
                    <div className="avatar avatar-sm">
                      {getInitials(user?.name)}
                    </div>
                    <div className="user-menu-info">
                      <span className="user-menu-name">{user?.name?.split(' ')[0]}</span>
                      <span className="user-menu-role">{user?.role}</span>
                    </div>
                    <span className={`user-menu-chevron${dropdownOpen ? ' open' : ''}`}>▼</span>
                  </button>

                  {dropdownOpen && (
                    <div className="user-dropdown">
                      <div className="user-dropdown-header">
                        <div className="user-dropdown-name">{user?.name}</div>
                        <div className="user-dropdown-email">{user?.email}</div>
                      </div>
                      {!isTrainer && (
                        <Link
                          to="/my-bookings"
                          className="user-dropdown-item"
                          onClick={() => setDropdownOpen(false)}
                        >
                          📋 My Bookings
                        </Link>
                      )}
                      <div className="user-dropdown-divider" />
                      <button className="user-dropdown-item danger" onClick={handleLogout}>
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {isAuthenticated && (
        <div className={`navbar-mobile${mobileOpen ? ' open' : ''}`}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            🏠 Home
          </NavLink>
          {!isTrainer && (
            <NavLink
              to="/my-bookings"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              📋 My Bookings
            </NavLink>
          )}
          <div style={{ height: '1px', background: 'var(--color-border)', margin: '8px 0' }} />
          <button
            className="navbar-link"
            style={{ border: 'none', background: 'none', color: 'var(--color-danger)', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
            onClick={handleLogout}
          >
            🚪 Sign Out
          </button>
        </div>
      )}
    </>
  );
}
