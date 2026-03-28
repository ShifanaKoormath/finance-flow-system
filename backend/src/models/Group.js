const mongoose = require("mongoose");

const ENTITY_TYPES = ["person", "source", "expense"];

const GroupSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ENTITY_TYPES, required: true },
  },
  { timestamps: true }
);

GroupSchema.index({ userId: 1, type: 1, name: 1 }, { unique: true });

module.exports = { 
  Group: mongoose.model("Group", GroupSchema),
  ENTITY_TYPES
};
