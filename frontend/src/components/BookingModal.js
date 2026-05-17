import React, { useState, useEffect, useRef } from 'react';
import { bookingsAPI, pricingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import './BookingModal.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  // Accepts "14:00" or ISO string
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function BookingModal({ slot, trainer, onClose, onSuccess }) {
  const { user, token } = useAuth();
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef(null);

  // Fetch calculated price on mount
  useEffect(() => {
    let cancelled = false;
    setPriceLoading(true);
    pricingAPI
      .calculatePrice({
        trainer_id: trainer.id,
        duration: slot.duration,
        hourly_rate: trainer.hourly_rate || trainer.hourlyRate,
      })
      .then((res) => {
        if (!cancelled) {
          setPrice(res.data.price ?? res.data.total ?? res.data.calculated_price ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback: calculate locally
          const rate = trainer.hourly_rate || trainer.hourlyRate || 0;
          const hrs = (slot.duration || 60) / 60;
          setPrice((rate * hrs).toFixed(2));
        }
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => { cancelled = true; };
  }, [slot, trainer]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await bookingsAPI.createBooking({
        trainer_id: trainer.id,
        trainee_id: user.id,
        slot_id: slot.id,
        date: slot.date,
        start_time: slot.start_time || slot.startTime,
        duration: slot.duration,
        notes,
        price,
      });
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.displayMessage || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal-box">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon">🏀</div>
          <div>
            <h2 className="modal-title">Confirm Booking</h2>
            <p className="modal-subtitle">Review your session details below</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {success ? (
          <div className="modal-success">
            <div className="modal-success-icon">✅</div>
            <h3>Booking Confirmed!</h3>
            <p>Your session with {trainer.name} has been booked.</p>
          </div>
        ) : (
          <>
            {/* Booking Details */}
            <div className="modal-details">
              <div className="modal-detail-row">
                <span className="modal-detail-icon">👤</span>
                <div>
                  <span className="modal-detail-label">Trainer</span>
                  <span className="modal-detail-value">{trainer.name}</span>
                </div>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-icon">📅</span>
                <div>
                  <span className="modal-detail-label">Date</span>
                  <span className="modal-detail-value">{formatDate(slot.date)}</span>
                </div>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-icon">🕐</span>
                <div>
                  <span className="modal-detail-label">Time</span>
                  <span className="modal-detail-value">
                    {formatTime(slot.start_time || slot.startTime)}
                  </span>
                </div>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-icon">⏱️</span>
                <div>
                  <span className="modal-detail-label">Duration</span>
                  <span className="modal-detail-value">
                    {slot.duration === 30 ? '30 minutes' : slot.duration === 60 ? '1 hour' : `${slot.duration} min`}
                  </span>
                </div>
              </div>
              <div className="modal-detail-row modal-price-row">
                <span className="modal-detail-icon">💰</span>
                <div>
                  <span className="modal-detail-label">Total Price</span>
                  <span className="modal-price">
                    {priceLoading ? <LoadingSpinner size="sm" /> : price !== null ? `$${price}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group modal-notes">
              <label className="form-label" htmlFor="booking-notes">Notes (optional)</label>
              <textarea
                id="booking-notes"
                className="form-textarea"
                placeholder="Any special requests or goals for this session…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            {/* Actions */}
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={loading || priceLoading}
              >
                {loading ? <><LoadingSpinner size="sm" color="#fff" /> Booking…</> : 'Confirm Booking'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
