const mongoose = require("mongoose");

const AllocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expenseTxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true,
    },
    incomeTxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true,
    },
    amountAllocated: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

AllocationSchema.index({ expenseTxId: 1, incomeTxId: 1 }, { unique: true });

module.exports = { Allocation: mongoose.model("Allocation", AllocationSchema) };
