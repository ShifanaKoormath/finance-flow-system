const express = require("express");
const { Group } = require("../models/Group");
const { Entity } = require("../models/Entity");
const mongoose = require("mongoose");
const { badRequest, notFound } = require("../utils/http");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, type } = req.body ?? {};
    if (!name || typeof name !== "string") return badRequest(res, "name is required");
    if (!type || !["person", "source", "expense"].includes(type)) return badRequest(res, "valid type is required");

    const group = await Group.create({ userId: req.user.userId, name: name.trim(), type });
    return res.status(201).json(group);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "Group already exists" });
    console.error("POST /api/groups error:", err);
    return res.status(500).json({ error: err.message || "Failed to create group" });
  }
});

router.get("/", async (req, res) => {
  try {
    const groups = await Group.find({ userId: req.user.userId }).sort({ type: 1, name: 1 }).lean();
    return res.json(groups);
  } catch (err) {
    console.error("GET /api/groups error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch groups" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid group id");

    const { name } = req.body ?? {};
    if (!name || typeof name !== "string") return badRequest(res, "name is required");

    const group = await Group.findOne({ _id: id, userId: req.user.userId });
    if (!group) return notFound(res, "Group not found");

    group.name = name.trim();
    await group.save();
    return res.json(group);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "Group name conflict" });
    console.error("PUT /api/groups/:id error:", err);
    return res.status(500).json({ error: err.message || "Failed to update group" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid group id");

    const group = await Group.findOneAndDelete({ _id: id, userId: req.user.userId });
    if (!group) return notFound(res, "Group not found");

    await Entity.updateMany({ groupId: id, userId: req.user.userId }, { $unset: { groupId: "" } });

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/groups/:id error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete group" });
  }
});

module.exports = router;
