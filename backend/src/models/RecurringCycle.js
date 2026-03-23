const mongoose = require("mongoose");

const RecurringCycleSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entity",
      required: true,
      index: true,
    },
    period: {
      type: String, // e.g., "2026-03"
      required: true,
      index: true,
    },
    expectedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

RecurringCycleSchema.index({ sourceId: 1, period: 1 }, { unique: true });

module.exports = { RecurringCycle: mongoose.model("RecurringCycle", RecurringCycleSchema) };
