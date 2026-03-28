const express = require("express");
const { Entity, ENTITY_TYPES, SOURCE_MODES, SOURCE_FREQUENCIES } = require("../models/Entity");
const { Group } = require("../models/Group");
const mongoose = require("mongoose");
const { badRequest, notFound } = require("../utils/http");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, type, mode, expectedAmount, frequency, totalAmount, groupId, recurringConfig, projectConfig } = req.body ?? {};

    if (!name || typeof name !== "string") {
      return badRequest(res, "name is required");
    }
    if (!type || !ENTITY_TYPES.includes(type)) {
      return badRequest(res, "type must be one of: person, source, expense");
    }

    const doc = {
      userId: req.user.userId,
      name: name.trim(),
      type,
    };

    if (type === "source") {
      if (mode && !SOURCE_MODES.includes(mode)) {
        return badRequest(res, "mode must be one of: simple, recurring, project");
      }
      if (frequency && !SOURCE_FREQUENCIES.includes(frequency)) {
        return badRequest(res, "frequency must be: monthly");
      }

      if (mode) doc.mode = mode;
      
      // Legacy flat fields support
      if (expectedAmount != null) doc.expectedAmount = Number(expectedAmount);
      if (frequency) doc.frequency = frequency;
      if (totalAmount != null) doc.totalAmount = Number(totalAmount);

      // New structures
      if (recurringConfig) doc.recurringConfig = recurringConfig;
      if (projectConfig) doc.projectConfig = projectConfig;
    }

    if (groupId) {
      if (!isValidObjectId(groupId)) return badRequest(res, "Invalid groupId");
      const group = await Group.findOne({ _id: groupId, userId: req.user.userId }).lean();
      if (!group) return badRequest(res, "Group not found");
      if (group.type !== type) return badRequest(res, "Group type must match entity type");
      doc.groupId = group._id;
    }

    const entity = await Entity.create(doc);
    return res.status(201).json(entity);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Entity already exists (same type + name)" });
    }
    console.error("POST /api/entities error:", err);
    return res.status(500).json({ error: err.message || "Failed to create entity" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid entity id");

    const { groupId, name } = req.body ?? {};
    
    const entity = await Entity.findOne({ _id: id, userId: req.user.userId });
    if (!entity) return notFound(res, "Entity not found");

    if (typeof name === "string" && name.trim()) {
      entity.name = name.trim();
    }

    if (groupId !== undefined) {
      if (groupId === null || groupId === "") {
        entity.groupId = undefined;
      } else {
        if (!isValidObjectId(groupId)) return badRequest(res, "Invalid groupId");
        const group = await Group.findOne({ _id: groupId, userId: req.user.userId }).lean();
        if (!group) return badRequest(res, "Group not found");
        if (group.type !== entity.type) return badRequest(res, "Group type must match entity type");
        entity.groupId = group._id;
      }
    }

    await entity.save();
    return res.json(entity);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "Entity name conflict" });
    console.error("PUT /api/entities/:id error:", err);
    return res.status(500).json({ error: err.message || "Failed to update entity" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid entity id");

    const entity = await Entity.findOne({ _id: id, userId: req.user.userId });
    if (!entity) return notFound(res, "Entity not found");

    // Prevent deletion if transactions exist
    const hasTransactions = await mongoose.model("Transaction").exists({
      $or: [{ from: id }, { to: id }],
      userId: req.user.userId
    });

    if (hasTransactions) {
      return res.status(400).json({ error: "Cannot delete entity with existing transactions." });
    }

    await Entity.deleteOne({ _id: id, userId: req.user.userId });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/entities/:id error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete entity" });
  }
});

router.get("/", async (req, res) => {
  try {
    const entities = await Entity.find({ userId: req.user.userId }).sort({ type: 1, name: 1 }).lean();
    return res.json(entities);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/entities error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch entities" });
  }
});

module.exports = router;

