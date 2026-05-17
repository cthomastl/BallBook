import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/LoadingSpinner';
import LoadingSpinner from '../components/LoadingSpinner';
import './MyBookings.css';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isUpcoming(dateStr, timeStr) {
  if (!dateStr) return false;
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    const bookingDate = new Date(year, month - 1, day, h, m);
    return bookingDate > new Date();
  } catch {
    return false;
  }
}

function StatusBadge({ status }) {
  const map = {
    confirmed: { label: 'Confirmed', className: 'badge-confirmed' },
    cancelled: { label: 'Cancelled', className: 'badge-cancelled' },
    completed: { label: 'Completed', className: 'badge-completed' },
    pending: { label: 'Pending', className: 'badge-pending' },
  };
  const s = map[status?.toLowerCase()] || map.pending;
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

function CancelModal({ booking, onConfirm, onClose, loading }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cancel-modal-box">
        <div className="cancel-modal-icon">⚠️</div>
        <h3 className="cancel-modal-title">Cancel Booking?</h3>
        <p className="cancel-modal-desc">
          Are you sure you want to cancel your session with <strong>{booking.trainer_name || 'this trainer'}</strong>?
          This action cannot be undone.
        </p>
        <div className="cancel-modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Keep Booking</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><LoadingSpinner size="sm" color="#fff" /> Cancelling…</> : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await bookingsAPI.getUserBookings(user.id);
      const data = res.data;
      setBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await bookingsAPI.cancelBooking(cancelTarget.id);
      setBookings((prev) =>
        prev.map((b) => b.id === cancelTarget.id ? { ...b, status: 'cancelled' } : b)
      );
      setSuccessMsg('Booking cancelled successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.displayMessage || 'Failed to cancel booking.');
    } finally {
      setCancelLoading(false);
      setCancelTarget(null);
    }
  };

  const upcomingBookings = bookings.filter((b) => {
    const upcoming = isUpcoming(b.date, b.start_time || b.startTime);
    return upcoming && b.status?.toLowerCase() !== 'cancelled';
  });

  const pastBookings = bookings.filter((b) => {
    const upcoming = isUpcoming(b.date, b.start_time || b.startTime);
    return !upcoming || b.status?.toLowerCase() === 'cancelled';
  });

  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="page-wrapper my-bookings-page">
      <div className="container">
        {/* Page Header */}
        <div className="my-bookings-header">
          <div>
            <h1 className="my-bookings-title">My Bookings</h1>
            <p className="my-bookings-subtitle">Manage your basketball training sessions</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            + Find a Trainer
          </button>
        </div>

        {/* Tabs */}
        <div className="my-bookings-tabs">
          <button
            className={`my-bookings-tab${activeTab === 'upcoming' ? ' active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
            {upcomingBookings.length > 0 && (
              <span className="tab-count">{upcomingBookings.length}</span>
            )}
          </button>
          <button
            className={`my-bookings-tab${activeTab === 'past' ? ' active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past &amp; Cancelled
            {pastBookings.length > 0 && (
              <span className="tab-count">{pastBookings.length}</span>
            )}
          </button>
        </div>

        {successMsg && (
          <div className="alert alert-success">{successMsg}</div>
        )}
        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {loading ? (
          <PageLoader />
        ) : displayedBookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {activeTab === 'upcoming' ? '📅' : '📋'}
            </div>
            <div className="empty-state-title">
              {activeTab === 'upcoming' ? 'No Upcoming Sessions' : 'No Past Sessions'}
            </div>
            <div className="empty-state-text">
              {activeTab === 'upcoming'
                ? 'You have no upcoming training sessions. Find a trainer and book your first session!'
                : 'Your completed and cancelled sessions will appear here.'}
            </div>
            {activeTab === 'upcoming' && (
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Find a Trainer
              </button>
            )}
          </div>
        ) : (
          <div className="bookings-list">
            {displayedBookings.map((booking) => {
              const upcoming = isUpcoming(booking.date, booking.start_time || booking.startTime);
              const canCancel = upcoming && booking.status?.toLowerCase() !== 'cancelled';
              return (
                <div key={booking.id} className={`booking-card card${booking.status?.toLowerCase() === 'cancelled' ? ' booking-card--cancelled' : ''}`}>
                  {/* Card header with trainer info */}
                  <div className="booking-card-header">
                    <div className="booking-trainer-avatar avatar avatar-md">
                      {(booking.trainer_name || booking.trainerName || 'T').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="booking-trainer-info">
                      <div className="booking-trainer-name">
                        {booking.trainer_name || booking.trainerName || `Trainer #${booking.trainer_id}`}
                      </div>
                      {booking.specialization && (
                        <div className="booking-trainer-spec">{booking.specialization}</div>
                      )}
                    </div>
                    <StatusBadge status={booking.status || 'confirmed'} />
                  </div>

                  {/* Booking details */}
                  <div className="booking-details">
                    <div className="booking-detail">
                      <span className="booking-detail-icon">📅</span>
                      <div>
                        <span className="booking-detail-label">Date</span>
                        <span className="booking-detail-value">{formatDate(booking.date)}</span>
                      </div>
                    </div>
                    <div className="booking-detail">
                      <span className="booking-detail-icon">🕐</span>
                      <div>
                        <span className="booking-detail-label">Time</span>
                        <span className="booking-detail-value">
                          {formatTime(booking.start_time || booking.startTime)}
                        </span>
                      </div>
                    </div>
                    <div className="booking-detail">
                      <span className="booking-detail-icon">⏱</span>
                      <div>
                        <span className="booking-detail-label">Duration</span>
                        <span className="booking-detail-value">
                          {booking.duration === 30 ? '30 min' : booking.duration === 60 ? '1 hour' : `${booking.duration || '—'} min`}
                        </span>
                      </div>
                    </div>
                    {booking.price != null && (
                      <div className="booking-detail">
                        <span className="booking-detail-icon">💰</span>
                        <div>
                          <span className="booking-detail-label">Price</span>
                          <span className="booking-detail-value booking-price">${booking.price}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {booking.notes && (
                    <div className="booking-notes">
                      <span className="booking-notes-label">Notes:</span> {booking.notes}
                    </div>
                  )}

                  {/* Actions */}
                  {canCancel && (
                    <div className="booking-card-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setCancelTarget(booking)}
                      >
                        Cancel Session
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}
