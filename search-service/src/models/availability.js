'use strict';

const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema(
  {
    trainer_id: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    start_time: {
      type: String, // HH:MM (24h)
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
    end_time: {
      type: String, // HH:MM (24h)
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
    duration_minutes: {
      type: Number,
      required: true,
      enum: [30, 60],
      default: 60,
    },
    is_booked: {
      type: Boolean,
      default: false,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index: one slot per trainer/date/start_time
availabilitySlotSchema.index({ trainer_id: 1, date: 1, start_time: 1 }, { unique: true });
availabilitySlotSchema.index({ trainer_id: 1, date: 1 });
availabilitySlotSchema.index({ date: 1, is_booked: 1 });

const AvailabilitySlot = mongoose.model('AvailabilitySlot', availabilitySlotSchema);

module.exports = AvailabilitySlot;
