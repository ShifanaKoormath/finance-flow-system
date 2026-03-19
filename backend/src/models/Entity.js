const mongoose = require("mongoose");

const ENTITY_TYPES = ["person", "source", "expense"];
const SOURCE_MODES = ["simple", "recurring", "project"];
const SOURCE_FREQUENCIES = ["monthly"];

const EntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ENTITY_TYPES, index: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      index: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", default: null, index: true },

    // Only meaningful when type === "source"
    mode: { type: String, enum: SOURCE_MODES },
    expectedAmount: { type: Number },
    frequency: { type: String, enum: SOURCE_FREQUENCIES },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

EntitySchema.index({ type: 1, name: 1 }, { unique: true });

module.exports = {
  Entity: mongoose.model("Entity", EntitySchema),
  ENTITY_TYPES,
  SOURCE_MODES,
  SOURCE_FREQUENCIES,
};

