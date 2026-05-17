import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TrainerCard.css';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function StarRating({ rating = 4.5 }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="stars" aria-label={`Rating: ${rating} out of 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} className="star">★</span>
      ))}
      {half && <span className="star">½</span>}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="star star-empty">★</span>
      ))}
      <span className="star-label">{rating.toFixed(1)}</span>
    </div>
  );
}

// Deterministic mock rating based on trainer id or name
function getMockRating(trainer) {
  const seed = (trainer.id || '').toString() + (trainer.name || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  // Range 3.8 – 5.0
  return Math.round((3.8 + (Math.abs(hash) % 120) / 100) * 10) / 10;
}

const SPEC_COLORS = {
  Shooting: '#FF6B2B',
  Defense: '#1B2A4A',
  Dribbling: '#7c3aed',
  Conditioning: '#059669',
  General: '#0284c7',
};

export default function TrainerCard({ trainer, featured = false }) {
  const navigate = useNavigate();
  const rating = getMockRating(trainer);

  const specColor = SPEC_COLORS[trainer.specialization] || SPEC_COLORS.General;

  return (
    <div className={`trainer-card${featured ? ' trainer-card--featured' : ''}`}>
      {featured && <div className="trainer-card__featured-badge">⭐ Featured</div>}

      <div className="trainer-card__header">
        <div className="avatar avatar-md trainer-card__avatar">
          {getInitials(trainer.name)}
        </div>
        <div className="trainer-card__header-info">
          <h3 className="trainer-card__name">{trainer.name}</h3>
          {trainer.specialization && (
            <span
              className="trainer-card__spec"
              style={{ color: specColor, borderColor: specColor, background: `${specColor}15` }}
            >
              {trainer.specialization}
            </span>
          )}
        </div>
      </div>

      <StarRating rating={rating} />

      {trainer.bio && (
        <p className="trainer-card__bio">
          {trainer.bio.length > 110 ? `${trainer.bio.slice(0, 110)}…` : trainer.bio}
        </p>
      )}

      <div className="trainer-card__footer">
        <div className="trainer-card__rate">
          <span className="trainer-card__rate-amount">
            ${trainer.hourly_rate || trainer.hourlyRate || '—'}
          </span>
          <span className="trainer-card__rate-label">/hr</span>
        </div>
        <button
          className="btn btn-primary btn-sm trainer-card__btn"
          onClick={() => navigate(`/trainers/${trainer.id}`)}
        >
          View &amp; Book
        </button>
      </div>
    </div>
  );
}
