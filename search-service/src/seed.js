'use strict';

/**
 * Seed script — populates MongoDB with sample availability slots.
 *
 * It first fetches real trainer IDs from the auth-service. If the auth-service
 * is unreachable it falls back to static UUIDs so you can run the seed
 * standalone.
 *
 * Usage:
 *   node src/seed.js                  # uses .env
 *   AUTH_SERVICE_URL=http://... node src/seed.js
 */

require('dotenv').config();

const axios = require('axios');
const { connectMongo } = require('./db');
const AvailabilitySlot = require('./models/availability');
const TrainerReview = require('./models/review');

// ─── helpers ─────────────────────────────────────────────────────────────────

// Returns an array of YYYY-MM-DD strings starting from today
function futureDates(count) {
  const dates = [];
  const base = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// Build a list of { start_time, end_time, duration_minutes } slot templates
function timeSlots() {
  return [
    { start_time: '08:00', end_time: '09:00', duration_minutes: 60 },
    { start_time: '09:30', end_time: '10:00', duration_minutes: 30 },
    { start_time: '10:00', end_time: '11:00', duration_minutes: 60 },
    { start_time: '11:30', end_time: '12:00', duration_minutes: 30 },
    { start_time: '14:00', end_time: '15:00', duration_minutes: 60 },
    { start_time: '15:30', end_time: '16:00', duration_minutes: 30 },
    { start_time: '17:00', end_time: '18:00', duration_minutes: 60 },
    { start_time: '18:30', end_time: '19:00', duration_minutes: 30 },
  ];
}

// Fetch trainer IDs from auth-service
async function fetchTrainerIds() {
  try {
    const url = `${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/auth/trainers`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const ids = (data.trainers || []).map((t) => t.id);
    if (ids.length > 0) {
      console.log(`Fetched ${ids.length} trainer(s) from auth-service`);
      return ids;
    }
  } catch (err) {
    console.warn(`Could not reach auth-service (${err.message}) — using static seed IDs`);
  }

  // Static fallback trainer IDs (replace with real ones if needed)
  return [
    'a1b2c3d4-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000002',
    'a1b2c3d4-0000-0000-0000-000000000003',
    'a1b2c3d4-0000-0000-0000-000000000004',
    'a1b2c3d4-0000-0000-0000-000000000005',
  ];
}

// ─── seed availability slots ──────────────────────────────────────────────────

async function seedAvailability(trainerIds) {
  const dates = futureDates(14); // next 2 weeks
  const slots = timeSlots();

  const docs = [];
  for (const trainerId of trainerIds) {
    // Give each trainer a random-ish hourly rate between $30 and $120
    const baseRate = 30 + Math.floor(Math.random() * 91);

    for (const date of dates) {
      // Each trainer gets a random subset of time slots on each day
      for (const slot of slots) {
        if (Math.random() > 0.45) continue; // ~55% chance to skip = sparse calendar
        const price =
          slot.duration_minutes === 30
            ? Math.round(baseRate / 2)
            : baseRate;

        docs.push({
          trainer_id: trainerId,
          date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes,
          is_booked: false,
          price,
        });
      }
    }
  }

  // Upsert to avoid duplicate key errors on re-seed
  let inserted = 0;
  let skipped = 0;
  for (const doc of docs) {
    try {
      await AvailabilitySlot.findOneAndUpdate(
        { trainer_id: doc.trainer_id, date: doc.date, start_time: doc.start_time },
        { $setOnInsert: doc },
        { upsert: true, new: false }
      );
      inserted++;
    } catch {
      skipped++;
    }
  }

  console.log(`Availability slots — inserted/found: ${inserted}, skipped: ${skipped}`);
}

// ─── seed reviews ─────────────────────────────────────────────────────────────

async function seedReviews(trainerIds) {
  const sampleComments = [
    'Excellent trainer, very knowledgeable and patient.',
    'Great session! Really improved my shooting technique.',
    'Professional and motivating. Highly recommended.',
    'Good drills, learned a lot about ball handling.',
    'Fantastic coach, tailored the session to my level.',
    'Very punctual and well-prepared. Will book again.',
    'Helped me understand defensive positioning like never before.',
    'Solid fundamentals trainer. My layups have improved massively.',
    'Friendly and encouraging. Perfect for beginners.',
    'Intensive but rewarding training. Worth every penny.',
  ];

  const reviewerBase = 'reviewer-seed-';
  let inserted = 0;
  let skipped = 0;

  for (const trainerId of trainerIds) {
    const reviewCount = 3 + Math.floor(Math.random() * 5); // 3–7 reviews per trainer
    for (let i = 0; i < reviewCount; i++) {
      const reviewer_id = `${reviewerBase}${i + 1}`;
      const rating = 3 + Math.floor(Math.random() * 3); // 3–5 stars
      const comment = sampleComments[Math.floor(Math.random() * sampleComments.length)];

      try {
        await TrainerReview.findOneAndUpdate(
          { trainer_id: trainerId, reviewer_id },
          { $setOnInsert: { trainer_id: trainerId, reviewer_id, rating, comment } },
          { upsert: true, new: false }
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`Reviews — inserted/found: ${inserted}, skipped: ${skipped}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to MongoDB...');
  await connectMongo();

  console.log('Fetching trainer IDs...');
  const trainerIds = await fetchTrainerIds();

  if (trainerIds.length === 0) {
    console.error('No trainer IDs found — nothing to seed');
    process.exit(1);
  }

  console.log(`Seeding data for ${trainerIds.length} trainer(s)...`);

  await seedAvailability(trainerIds);
  await seedReviews(trainerIds);

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
