'use strict';

const { Router } = require('express');
const axios = require('axios');
const AvailabilitySlot = require('../models/availability');
const TrainerReview = require('../models/review');
const { authenticate, authenticateViaService, requireRole } = require('../middleware/auth');

const router = Router();

// Helper: get auth service base URL
function authServiceUrl() {
  return process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
}

// Helper: fetch all trainers from auth-service (optionally filtered by ids)
async function fetchTrainersFromAuth(ids) {
  const params = ids && ids.length > 0 ? { ids: ids.join(',') } : {};
  const response = await axios.get(`${authServiceUrl()}/auth/trainers`, {
    params,
    timeout: 8000,
  });
  return response.data.trainers || [];
}

// Helper: compute aggregate stats (avg rating, review count) for a trainer
async function getTrainerStats(trainerId) {
  const reviews = await TrainerReview.find({ trainer_id: trainerId }).lean();
  if (reviews.length === 0) {
    return { rating: null, review_count: 0 };
  }
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { rating: Math.round(avg * 10) / 10, review_count: reviews.length };
}

// Helper: count upcoming available (unbooked) slots for a trainer
async function getAvailableSlotCount(trainerId) {
  const today = new Date().toISOString().split('T')[0];
  return AvailabilitySlot.countDocuments({
    trainer_id: trainerId,
    is_booked: false,
    date: { $gte: today },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/trainers
// Query params: ?q=, ?specialization=, ?minPrice=, ?maxPrice=, ?available=true
// ─────────────────────────────────────────────────────────────────────────────
router.get('/trainers', async (req, res) => {
  try {
    const { q, specialization, minPrice, maxPrice, available } = req.query;

    // Fetch all trainers from auth-service
    let trainers = await fetchTrainersFromAuth();

    // Filter by text query (name, bio, specialization)
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      trainers = trainers.filter((t) => {
        return (
          (t.name && t.name.toLowerCase().includes(term)) ||
          (t.bio && t.bio.toLowerCase().includes(term)) ||
          (t.specialization && t.specialization.toLowerCase().includes(term))
        );
      });
    }

    // Filter by specialization
    if (specialization && specialization.trim()) {
      const spec = specialization.trim().toLowerCase();
      trainers = trainers.filter(
        (t) => t.specialization && t.specialization.toLowerCase().includes(spec)
      );
    }

    // Filter by price range
    if (minPrice !== undefined) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        trainers = trainers.filter((t) => t.hourly_rate !== null && parseFloat(t.hourly_rate) >= min);
      }
    }
    if (maxPrice !== undefined) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        trainers = trainers.filter((t) => t.hourly_rate !== null && parseFloat(t.hourly_rate) <= max);
      }
    }

    // Filter by availability — keep only trainers with at least one upcoming free slot
    if (available === 'true') {
      const today = new Date().toISOString().split('T')[0];
      const trainerIds = trainers.map((t) => t.id);

      // Aggregate available slot counts in one query
      const availableCounts = await AvailabilitySlot.aggregate([
        {
          $match: {
            trainer_id: { $in: trainerIds },
            is_booked: false,
            date: { $gte: today },
          },
        },
        { $group: { _id: '$trainer_id', count: { $sum: 1 } } },
      ]);

      const availableSet = new Set(availableCounts.map((a) => a._id));
      trainers = trainers.filter((t) => availableSet.has(t.id));
    }

    // Enrich with stats from MongoDB
    const enriched = await Promise.all(
      trainers.map(async (trainer) => {
        const [stats, slot_count] = await Promise.all([
          getTrainerStats(trainer.id),
          getAvailableSlotCount(trainer.id),
        ]);
        return { ...trainer, ...stats, available_slot_count: slot_count };
      })
    );

    return res.status(200).json({ trainers: enriched, total: enriched.length });
  } catch (err) {
    if (err.response) {
      console.error('Auth service error:', err.response.status, err.response.data);
      return res.status(502).json({ error: 'Failed to fetch trainer data from auth service' });
    }
    console.error('Search trainers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/trainers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/trainers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch trainer profile from auth-service
    const trainers = await fetchTrainersFromAuth([id]);
    if (!trainers || trainers.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    const trainer = trainers[0];

    // Fetch upcoming availability slots from MongoDB
    const today = new Date().toISOString().split('T')[0];
    const slots = await AvailabilitySlot.find({
      trainer_id: id,
      date: { $gte: today },
    })
      .sort({ date: 1, start_time: 1 })
      .lean();

    // Fetch reviews
    const reviews = await TrainerReview.find({ trainer_id: id })
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    const stats = await getTrainerStats(id);

    return res.status(200).json({
      trainer: {
        ...trainer,
        ...stats,
        availability: slots,
        reviews,
      },
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'Failed to fetch trainer data from auth service' });
    }
    console.error('Get trainer by id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/availability/:trainerId
// Returns upcoming available slots for the trainer
// Query params: ?date=YYYY-MM-DD, ?duration=30|60
// ─────────────────────────────────────────────────────────────────────────────
router.get('/availability/:trainerId', async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { date, duration } = req.query;

    const today = new Date().toISOString().split('T')[0];

    const filter = {
      trainer_id: trainerId,
      is_booked: false,
      date: { $gte: today },
    };

    if (date) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      }
      filter.date = date;
    }

    if (duration) {
      const dur = parseInt(duration, 10);
      if (![30, 60].includes(dur)) {
        return res.status(400).json({ error: 'duration must be 30 or 60' });
      }
      filter.duration_minutes = dur;
    }

    const slots = await AvailabilitySlot.find(filter)
      .sort({ date: 1, start_time: 1 })
      .lean();

    return res.status(200).json({ trainer_id: trainerId, slots, total: slots.length });
  } catch (err) {
    console.error('Get availability error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /search/availability
// Create an availability slot (trainers only)
// Body: { date, start_time, end_time, duration_minutes, price }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/availability', authenticateViaService, requireRole('trainer'), async (req, res) => {
  try {
    const { date, start_time, end_time, duration_minutes, price } = req.body;
    const trainer_id = req.user.id;

    // Validate required fields
    if (!date || !start_time || !end_time || price === undefined) {
      return res.status(400).json({ error: 'date, start_time, end_time, and price are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
      return res.status(400).json({ error: 'start_time and end_time must be in HH:MM format' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ error: 'Cannot create availability slots in the past' });
    }

    const dur = duration_minutes ? parseInt(duration_minutes, 10) : 60;
    if (![30, 60].includes(dur)) {
      return res.status(400).json({ error: 'duration_minutes must be 30 or 60' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'price must be a non-negative number' });
    }

    // Check for time ordering
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'start_time must be before end_time' });
    }

    const slot = new AvailabilitySlot({
      trainer_id,
      date,
      start_time,
      end_time,
      duration_minutes: dur,
      is_booked: false,
      price: parsedPrice,
    });

    await slot.save();

    return res.status(201).json({ message: 'Availability slot created', slot });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An availability slot already exists for that date and time' });
    }
    console.error('Create availability error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /search/availability/:slotId
// Trainers can delete their own unbooked slots; admins can delete any
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/availability/:slotId', authenticateViaService, requireRole('trainer'), async (req, res) => {
  try {
    const { slotId } = req.params;
    const trainer_id = req.user.id;

    const slot = await AvailabilitySlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slot.trainer_id !== trainer_id) {
      return res.status(403).json({ error: 'You can only delete your own availability slots' });
    }

    if (slot.is_booked) {
      return res.status(409).json({ error: 'Cannot delete a slot that is already booked' });
    }

    await slot.deleteOne();

    return res.status(200).json({ message: 'Availability slot deleted' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid slot ID' });
    }
    console.error('Delete availability error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/featured
// Returns trainers with the highest average ratings and slot availability
// ─────────────────────────────────────────────────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);

    // Aggregate top-rated trainers from reviews
    const topRatings = await TrainerReview.aggregate([
      {
        $group: {
          _id: '$trainer_id',
          avg_rating: { $avg: '$rating' },
          review_count: { $sum: 1 },
        },
      },
      { $sort: { avg_rating: -1, review_count: -1 } },
      { $limit: limit * 2 }, // fetch extra to compensate for filtering
    ]);

    const today = new Date().toISOString().split('T')[0];

    // Build set of trainer IDs that have available slots
    const availableTrainerIds = await AvailabilitySlot.distinct('trainer_id', {
      is_booked: false,
      date: { $gte: today },
    });
    const availableSet = new Set(availableTrainerIds);

    // Fetch trainer profiles from auth-service
    const ratedTrainerIds = topRatings.map((r) => r._id);

    let trainerProfiles = [];
    if (ratedTrainerIds.length > 0) {
      trainerProfiles = await fetchTrainersFromAuth(ratedTrainerIds);
    }

    // If we don't have enough rated trainers, supplement with others
    if (trainerProfiles.length < limit) {
      const allTrainers = await fetchTrainersFromAuth();
      const existingIds = new Set(trainerProfiles.map((t) => t.id));
      const extra = allTrainers
        .filter((t) => !existingIds.has(t.id) && availableSet.has(t.id))
        .slice(0, limit - trainerProfiles.length);
      trainerProfiles = [...trainerProfiles, ...extra];
    }

    // Build map of stats
    const statsMap = {};
    for (const r of topRatings) {
      statsMap[r._id] = { rating: Math.round(r.avg_rating * 10) / 10, review_count: r.review_count };
    }

    // Enrich and sort
    const featured = trainerProfiles.slice(0, limit).map((trainer) => {
      const stats = statsMap[trainer.id] || { rating: null, review_count: 0 };
      return {
        ...trainer,
        ...stats,
        is_available: availableSet.has(trainer.id),
      };
    });

    // Sort: available first, then by rating desc
    featured.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
      if (b.rating === null && a.rating === null) return 0;
      if (b.rating === null) return -1;
      if (a.rating === null) return 1;
      return b.rating - a.rating;
    });

    return res.status(200).json({ trainers: featured, total: featured.length });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'Failed to fetch trainer data from auth service' });
    }
    console.error('Featured trainers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
