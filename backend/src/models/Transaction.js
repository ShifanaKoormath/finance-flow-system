const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entity",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entity",
      required: true,
      index: true,
    },
    title: { type: String, trim: true },
    note: { type: String, trim: true },
    date: { type: Date, default: () => new Date(), index: true },

    // Linking fields for tracing usage of a specific received transaction or a general source.
    sourceTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", index: true },
    sourceEntityId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", index: true },

    // New Fields for FlowLedger Extensions
    type: { type: String, enum: ["income", "expense"], index: true },
    
    // For Recurring Sources linking specifically to a month's cycle
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringCycle", default: null, index: true },
    
    // For Income Transactions to track FIFO allocation
    remainingAmount: { type: Number, min: 0 },
  },
  { timestamps: true }
);

TransactionSchema.pre('validate', function() {
  if (this.sourceTransactionId && this.sourceEntityId) {
    this.invalidate('sourceTransactionId', 'Cannot have both sourceTransactionId and sourceEntityId');
  }
});

TransactionSchema.index({ from: 1, to: 1, date: -1 });

module.exports = { Transaction: mongoose.model("Transaction", TransactionSchema) };

