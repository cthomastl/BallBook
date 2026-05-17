import React, { useState, useEffect, useCallback } from 'react';
import { searchAPI } from '../services/api';
import TrainerCard from '../components/TrainerCard';
import { PageLoader } from '../components/LoadingSpinner';
import './Home.css';

const SPECIALIZATIONS = ['', 'Shooting', 'Defense', 'Dribbling', 'Conditioning', 'General'];
const DURATIONS = [
  { label: 'Any Duration', value: '' },
  { label: '30 min', value: '30' },
  { label: '1 hour', value: '60' },
];

function HeroIcon() {
  return (
    <svg className="hero-ball-icon" width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" stroke="rgba(255,107,43,0.4)" strokeWidth="2" fill="rgba(255,107,43,0.08)" />
      <circle cx="28" cy="28" r="18" stroke="rgba(255,107,43,0.6)" strokeWidth="2" fill="rgba(255,107,43,0.12)" />
      <path d="M28 10C28 10 20 18 20 28s8 18 8 18" stroke="#FF6B2B" strokeWidth="2" fill="none" />
      <path d="M28 10C28 10 36 18 36 28s-8 18-8 18" stroke="#FF6B2B" strokeWidth="2" fill="none" />
      <path d="M10 28h36" stroke="#FF6B2B" strokeWidth="2" />
    </svg>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    specialization: '',
    minPrice: '',
    maxPrice: '',
    duration: '',
  });
  const [trainers, setTrainers] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Load featured trainers on mount
  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await searchAPI.getFeatured();
        const data = res.data;
        setFeatured(Array.isArray(data) ? data : data.trainers || []);
      } catch {
        // Featured section is non-critical; ignore error
      }
    }
    loadFeatured();
  }, []);

  // Load all trainers on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const res = await searchAPI.searchTrainers({});
        const data = res.data;
        setTrainers(Array.isArray(data) ? data : data.trainers || []);
      } catch (err) {
        setError(err.displayMessage || 'Failed to load trainers.');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    setSearchLoading(true);
    setError('');
    setHasSearched(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (filters.specialization) params.specialization = filters.specialization;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      const res = await searchAPI.searchTrainers(params);
      const data = res.data;
      setTrainers(Array.isArray(data) ? data : data.trainers || []);
    } catch (err) {
      setError(err.displayMessage || 'Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, filters]);

  const handleFilterChange = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const handleReset = async () => {
    setSearchQuery('');
    setFilters({ specialization: '', minPrice: '', maxPrice: '', duration: '' });
    setHasSearched(false);
    setLoading(true);
    setError('');
    try {
      const res = await searchAPI.searchTrainers({});
      const data = res.data;
      setTrainers(Array.isArray(data) ? data : data.trainers || []);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load trainers.');
    } finally {
      setLoading(false);
    }
  };

  const filteredByDuration = filters.duration
    ? trainers // duration filter is client-side hint; backend may not support it
    : trainers;

  const showFeatured = featured.length > 0 && !hasSearched;

  return (
    <div className="page-wrapper home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg-pattern" aria-hidden="true" />
        <div className="container hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <HeroIcon />
              <span>Professional Basketball Training</span>
            </div>
            <h1 className="hero-title">
              Find Your
              <br />
              <span className="hero-title-accent">Basketball</span>
              <br />
              Trainer
            </h1>
            <p className="hero-subtitle">
              Connect with certified coaches for personalized training sessions.
              Level up your game — from shooting to defense and beyond.
            </p>
          </div>

          {/* Search Bar */}
          <form className="hero-search-form" onSubmit={handleSearch}>
            <div className="hero-search-bar">
              <span className="hero-search-icon">🔍</span>
              <input
                type="text"
                className="hero-search-input"
                placeholder="Search by name or specialization…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary hero-search-btn" disabled={searchLoading}>
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="filter-bar-section">
        <div className="container">
          <div className="filter-bar">
            <div className="filter-group">
              <label className="filter-label">Specialization</label>
              <select
                className="form-select filter-select"
                value={filters.specialization}
                onChange={(e) => handleFilterChange('specialization', e.target.value)}
              >
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{s || 'All Specializations'}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Min Price ($/hr)</label>
              <input
                type="number"
                className="form-input filter-input"
                placeholder="0"
                min="0"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Max Price ($/hr)</label>
              <input
                type="number"
                className="form-input filter-input"
                placeholder="500"
                min="0"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Duration</label>
              <div className="filter-duration-btns">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`filter-duration-btn${filters.duration === d.value ? ' active' : ''}`}
                    onClick={() => handleFilterChange('duration', d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={searchLoading}>
                Apply Filters
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container home-content">
        {error && <div className="alert alert-error" style={{ marginTop: 24 }}>{error}</div>}

        {/* Featured Section */}
        {showFeatured && (
          <section className="home-section">
            <div className="section-header">
              <h2 className="section-title">⭐ Featured Trainers</h2>
              <p className="section-subtitle">Top-rated coaches on BallBook this month</p>
            </div>
            <div className="grid-3">
              {featured.slice(0, 3).map((trainer) => (
                <TrainerCard key={trainer.id} trainer={trainer} featured />
              ))}
            </div>
          </section>
        )}

        {/* All Trainers */}
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">
              {hasSearched ? 'Search Results' : 'All Trainers'}
            </h2>
            {!loading && !searchLoading && (
              <p className="section-subtitle">
                {filteredByDuration.length === 0
                  ? 'No trainers found'
                  : `${filteredByDuration.length} trainer${filteredByDuration.length !== 1 ? 's' : ''} available`}
              </p>
            )}
          </div>

          {(loading || searchLoading) ? (
            <PageLoader />
          ) : filteredByDuration.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏀</div>
              <div className="empty-state-title">No trainers found</div>
              <div className="empty-state-text">
                Try adjusting your search terms or filters to find available trainers.
              </div>
              <button className="btn btn-primary" onClick={handleReset}>Clear Filters</button>
            </div>
          ) : (
            <div className="grid-3">
              {filteredByDuration.map((trainer) => (
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
