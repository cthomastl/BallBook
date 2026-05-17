'use strict';

const mongoose = require('mongoose');

const trainerReviewSchema = new mongoose.Schema(
  {
    trainer_id: {
      type: String,
      required: true,
      index: true,
    },
    reviewer_id: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

// One review per reviewer per trainer
trainerReviewSchema.index({ trainer_id: 1, reviewer_id: 1 }, { unique: true });
trainerReviewSchema.index({ trainer_id: 1, created_at: -1 });

const TrainerReview = mongoose.model('TrainerReview', trainerReviewSchema);

module.exports = TrainerReview;
