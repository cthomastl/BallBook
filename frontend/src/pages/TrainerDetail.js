import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { searchAPI, pricingAPI } from '../services/api';
import BookingModal from '../components/BookingModal';
import { PageLoader } from '../components/LoadingSpinner';
import LoadingSpinner from '../components/LoadingSpinner';
import './TrainerDetail.css';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function StarRating({ rating = 4.5 }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="stars">
      {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="star">★</span>)}
      {half && <span className="star">½</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="star star-empty">★</span>)}
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function getMockRating(trainer) {
  const seed = (trainer.id || '').toString() + (trainer.name || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return Math.round((3.8 + (Math.abs(hash) % 120) / 100) * 10) / 10;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const SPEC_COLORS = {
  Shooting: '#FF6B2B',
  Defense: '#1B2A4A',
  Dribbling: '#7c3aed',
  Conditioning: '#059669',
  General: '#0284c7',
};

export default function TrainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trainer, setTrainer] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotPrices, setSlotPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    async function loadTrainer() {
      setLoading(true);
      try {
        const res = await searchAPI.getTrainer(id);
        setTrainer(res.data);
      } catch (err) {
        setError(err.displayMessage || 'Trainer not found.');
      } finally {
        setLoading(false);
      }
    }
    loadTrainer();
  }, [id]);

  useEffect(() => {
    if (!trainer) return;
    async function loadSlots() {
      setSlotsLoading(true);
      try {
        const res = await searchAPI.getAvailability(id);
        const data = res.data;
        const list = Array.isArray(data) ? data : data.slots || data.availability || [];
        setSlots(list);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    }
    loadSlots();
  }, [id, trainer]);

  // Fetch prices for slots in parallel (best effort)
  useEffect(() => {
    if (!trainer || slots.length === 0) return;
    const rate = trainer.hourly_rate || trainer.hourlyRate || 0;

    slots.forEach((slot) => {
      const key = slot.id || `${slot.date}-${slot.start_time}`;
      const duration = slot.duration || 60;
      pricingAPI
        .calculatePrice({ trainer_id: trainer.id, duration, hourly_rate: rate })
        .then((res) => {
          const p = res.data.price ?? res.data.total ?? res.data.calculated_price ?? null;
          setSlotPrices((prev) => ({ ...prev, [key]: p }));
        })
        .catch(() => {
          // Fallback calc
          const hrs = duration / 60;
          setSlotPrices((prev) => ({ ...prev, [key]: (rate * hrs).toFixed(2) }));
        });
    });
  }, [trainer, slots]);

  if (loading) return <div className="page-wrapper"><PageLoader /></div>;
  if (error) return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    </div>
  );
  if (!trainer) return null;

  const rating = getMockRating(trainer);
  const specColor = SPEC_COLORS[trainer.specialization] || SPEC_COLORS.General;

  const groupedSlots = slots.reduce((acc, slot) => {
    const dateKey = slot.date || 'Unknown Date';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(slot);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedSlots).sort();

  return (
    <div className="page-wrapper trainer-detail-page">
      <div className="container">
        {/* Back button */}
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="trainer-detail-layout">
          {/* Left: Trainer Profile */}
          <aside className="trainer-profile-card card">
            {/* Avatar */}
            <div className="trainer-profile-avatar-wrap">
              <div className="avatar avatar-xl trainer-profile-avatar">
                {getInitials(trainer.name)}
              </div>
            </div>

            <div className="trainer-profile-info">
              <h1 className="trainer-profile-name">{trainer.name}</h1>

              {trainer.specialization && (
                <span
                  className="trainer-profile-spec"
                  style={{ color: specColor, borderColor: specColor, background: `${specColor}15` }}
                >
                  {trainer.specialization}
                </span>
              )}

              <StarRating rating={rating} />

              <div className="trainer-profile-rate">
                <span className="trainer-profile-rate-amount">
                  ${trainer.hourly_rate || trainer.hourlyRate || '—'}
                </span>
                <span className="trainer-profile-rate-label">per hour</span>
              </div>
            </div>

            {trainer.bio && (
              <>
                <div className="divider" />
                <div className="trainer-profile-bio-section">
                  <h3 className="trainer-profile-bio-title">About</h3>
                  <p className="trainer-profile-bio">{trainer.bio}</p>
                </div>
              </>
            )}

            <div className="divider" />

            <div className="trainer-profile-stats">
              <div className="trainer-profile-stat">
                <span className="trainer-profile-stat-value">{slots.length}</span>
                <span className="trainer-profile-stat-label">Available Slots</span>
              </div>
              <div className="trainer-profile-stat">
                <span className="trainer-profile-stat-value">{rating}</span>
                <span className="trainer-profile-stat-label">Rating</span>
              </div>
            </div>
          </aside>

          {/* Right: Availability */}
          <main className="trainer-slots-section">
            <div className="trainer-slots-header">
              <h2 className="section-title">Available Sessions</h2>
              <p className="section-subtitle">Select a time slot and book your training session</p>
            </div>

            {slotsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <LoadingSpinner size="lg" />
              </div>
            ) : slots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">No Available Slots</div>
                <div className="empty-state-text">
                  This trainer hasn't posted any available sessions yet. Check back soon!
                </div>
              </div>
            ) : (
              <div className="slots-by-date">
                {sortedDates.map((date) => (
                  <div key={date} className="date-group">
                    <div className="date-group-header">
                      <span className="date-group-icon">📅</span>
                      <span className="date-group-label">{formatDate(date)}</span>
                    </div>
                    <div className="slots-grid">
                      {groupedSlots[date].map((slot) => {
                        const key = slot.id || `${slot.date}-${slot.start_time}`;
                        const price = slotPrices[key];
                        return (
                          <div key={key} className="slot-card">
                            <div className="slot-time">
                              🕐 {formatTime(slot.start_time || slot.startTime)}
                            </div>
                            <div className="slot-duration">
                              ⏱ {slot.duration === 30 ? '30 min' : slot.duration === 60 ? '1 hr' : `${slot.duration} min`}
                            </div>
                            <div className="slot-price">
                              {price !== undefined
                                ? <><span className="slot-price-amount">${price}</span></>
                                : <LoadingSpinner size="sm" />
                              }
                            </div>
                            <button
                              className="btn btn-primary btn-sm slot-book-btn"
                              onClick={() => setSelectedSlot(slot)}
                            >
                              Book Now
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          trainer={trainer}
          onClose={() => setSelectedSlot(null)}
          onSuccess={() => {
            setSelectedSlot(null);
            navigate('/my-bookings');
          }}
        />
      )}
    </div>
  );
}
