const express = require("express");
const mongoose = require("mongoose");
const { RecurringCycle } = require("../models/RecurringCycle");
const { Entity } = require("../models/Entity");
const { Transaction } = require("../models/Transaction");
const { badRequest, notFound } = require("../utils/http");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function generateCyclesForSource(source) {
  if (!source || source.mode !== "recurring") return;
  const start = source.recurringConfig?.startDate || source.createdAt;
  if (!start) return;

  const startD = new Date(start);
  const now = new Date();
  
  let mYear = startD.getFullYear();
  let mMonth = startD.getMonth() + 1;
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  const periodStrings = [];
  while (mYear < endYear || (mYear === endYear && mMonth <= endMonth)) {
    const pStr = `${mYear}-${String(mMonth).padStart(2, '0')}`;
    periodStrings.push(pStr);
    mMonth++;
    if (mMonth > 12) { mMonth = 1; mYear++; }
  }

  const existingCycles = await RecurringCycle.find({ sourceId: source._id, period: { $in: periodStrings } }).lean();
  const existingPeriods = new Set(existingCycles.map(c => c.period));

  const expectedAmount = source.recurringConfig?.expectedAmount || source.expectedAmount || 0;

  // Backfill existing cycles that have 0 expectedAmount due to bug
  if (expectedAmount > 0) {
    const cyclesToFix = existingCycles.filter(c => c.expectedAmount === 0 || c.expectedAmount == null);
    if (cyclesToFix.length > 0) {
       await RecurringCycle.updateMany(
         { _id: { $in: cyclesToFix.map(c => c._id) } },
         { $set: { expectedAmount } }
       );
    }
  }

  const toCreate = [];
  for (const pStr of periodStrings) {
    if (!existingPeriods.has(pStr)) {
      toCreate.push({
        sourceId: source._id,
        period: pStr,
        expectedAmount,
        receivedAmount: 0
      });
    }
  }

  if (toCreate.length > 0) {
    await RecurringCycle.insertMany(toCreate);
  }
}

// GET /api/cycles/:sourceId - Get all cycles for a specific source
router.get("/:sourceId", async (req, res) => {
  try {
    const { sourceId } = req.params;
    if (!isValidObjectId(sourceId)) return badRequest(res, "Invalid source id");

    const source = await Entity.findById(sourceId).lean();
    if (!source || source.type !== "source") return badRequest(res, "Valid source is required");

    await generateCyclesForSource(source);

    const cycles = await RecurringCycle.find({ sourceId }).sort({ period: -1 }).lean();
    
    // We will dynamically return statuses
    const cyclesWithStatus = cycles.map(c => {
      let status = "pending";
      const remaining = Math.max(0, c.expectedAmount - c.receivedAmount);
      
      if (c.expectedAmount > 0 && c.receivedAmount >= c.expectedAmount) {
        status = "settled";
      } else if (c.receivedAmount > 0) {
        status = "partial";
      }
      
      // Basic overdue logic: if the cycle's period (YYYY-MM) is strictly before current month
      const currentMonth = new Date().toISOString().slice(0, 7); // e.g., "2026-03"
      if (status !== "settled" && c.period < currentMonth) {
        status = "overdue";
      }
      
      return { ...c, remaining, status };
    });

    return res.json(cyclesWithStatus);
  } catch (err) {
    console.error("GET /api/cycles/:sourceId error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch cycles" });
  }
});

// POST /api/cycles - Create a new cycle manually
router.post("/", async (req, res) => {
  try {
    const { sourceId, period, expectedAmount } = req.body;
    
    if (!sourceId || !isValidObjectId(sourceId)) return badRequest(res, "sourceId is required and must be valid");
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return badRequest(res, "period must be YYYY-MM");
    if (expectedAmount === undefined || expectedAmount < 0) return badRequest(res, "expectedAmount must be >= 0");

    const source = await Entity.findById(sourceId).lean();
    if (!source || source.type !== "source") return badRequest(res, "Valid source is required");

    const existingCycle = await RecurringCycle.findOne({ sourceId, period });
    if (existingCycle) {
      return badRequest(res, `Cycle for period ${period} already exists`);
    }

    const cycle = await RecurringCycle.create({
      sourceId,
      period,
      expectedAmount,
      receivedAmount: 0
    });

    return res.status(201).json(cycle);
  } catch (err) {
    console.error("POST /api/cycles error:", err);
    return res.status(500).json({ error: err.message || "Failed to create cycle" });
  }
});

// GET /api/cycles/:cycleId/transactions - Get income & usage for a cycle
router.get("/:cycleId/transactions", async (req, res) => {
  try {
    const { cycleId } = req.params;
    if (!isValidObjectId(cycleId)) return badRequest(res, "Invalid cycle id");

    const txs = await Transaction.find({ cycleId })
      .sort({ date: -1, createdAt: -1 })
      .populate("from", "name type mode")
      .populate("to", "name type mode")
      .lean();
    
    const income = txs.filter(t => t.type === 'income');
    const expenses = txs.filter(t => t.type === 'expense');

    return res.json({ income, expenses });
  } catch (err) {
    console.error("GET /api/cycles/:cycleId/transactions error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch cycle transactions" });
  }
});

module.exports = router;
