const express = require("express");
const mongoose = require("mongoose");
const { Transaction } = require("../models/Transaction");
const { Entity } = require("../models/Entity");
const { badRequest, notFound } = require("../utils/http");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/source/:id/summary
router.get("/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid source id");

    const source = await Entity.findById(id).lean();
    if (!source) return notFound(res, "Source not found");
    if (source.type !== "source") return badRequest(res, "Entity is not a source");

    // 1) receivedTxs: transactions where from = source (money coming in from this source)
    const receivedTxs = await Transaction.find({ from: id }).sort({ date: -1, createdAt: -1 }).lean();
    const receivedIds = receivedTxs.map((t) => t._id);

    // 3) usageTxs: transactions that point to those receipts OR general source usage
    const usageTxs = await Transaction.find({
      $or: [{ sourceTransactionId: { $in: receivedIds } }, { sourceEntityId: id }],
    })
      .populate("to", "name type")
      .lean();

    const totalReceived = receivedTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalUsed = usageTxs.reduce((sum, t) => sum + t.amount, 0);
    const remaining = totalReceived - totalUsed;

    const map = new Map();
    for (const t of usageTxs) {
      const to = t.to;
      const name = to?.name ?? "Unknown";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    }

    const breakdown = Array.from(map.entries())
      .map(([entityName, totalAmount]) => ({ entityName, totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return res.json({ totalReceived, totalUsed, remaining, breakdown });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/source/:id/summary error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch source summary" });
  }
});

module.exports = router;

