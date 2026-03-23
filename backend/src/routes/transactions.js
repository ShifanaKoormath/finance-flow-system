const express = require("express");
const mongoose = require("mongoose");
const { Transaction } = require("../models/Transaction");
const { Entity } = require("../models/Entity");
const { RecurringCycle } = require("../models/RecurringCycle");
const { Allocation } = require("../models/Allocation");
const { badRequest, notFound } = require("../utils/http");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.post("/", async (req, res) => {
  try {
    const { amount, from, to, title, note, date, sourceTransactionId, sourceEntityId, cycleId, type } = req.body ?? {};

    // 1. Validate Amount
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return badRequest(res, "amount must be a positive number");
    }

    // 2. Safely Validate ObjectIds
    if (!from || !isValidObjectId(from)) return badRequest(res, "from is required and must be a valid id");
    if (!to || !isValidObjectId(to)) return badRequest(res, "to is required and must be a valid id");

    // 3. Source Linking Validation
    if (sourceTransactionId !== undefined && sourceEntityId !== undefined) {
      // If both keys are present (even if one is empty/falsy), enforce only one
      if (sourceTransactionId && sourceEntityId) {
        return badRequest(res, "Cannot provide both sourceTransactionId and sourceEntityId");
      }
    }
    
    // Safely validate the provided linking id
    let sTxId = undefined;
    if (sourceTransactionId) {
      if (!isValidObjectId(sourceTransactionId)) return badRequest(res, "sourceTransactionId must be an id");
      sTxId = sourceTransactionId;
    }
    
    let sEntId = undefined;
    if (sourceEntityId) {
      if (!isValidObjectId(sourceEntityId)) return badRequest(res, "sourceEntityId must be an id");
      sEntId = sourceEntityId;
    }

    // Double check mutual exclusivity
    if (sTxId && sEntId) {
      return badRequest(res, "Cannot provide both sourceTransactionId and sourceEntityId");
    }

    // 4. Verify Entity References
    const [fromEntity, toEntity] = await Promise.all([
      Entity.findById(from).lean(), 
      Entity.findById(to).lean()
    ]);
    if (!fromEntity) return notFound(res, "from entity not found");
    if (!toEntity) return notFound(res, "to entity not found");

    // 5. Ensure Date Handling is Safe
    let safeDate = new Date(); // fallback
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        safeDate = parsed;
      }
    }

    // 6. Create Transaction
    const txData = {
      amount: amt,
      from,
      to,
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      note: typeof note === "string" && note.trim() ? note.trim() : undefined,
      date: safeDate,
      sourceTransactionId: sTxId,
      sourceEntityId: sEntId,
      type: type === "income" || type === "expense" ? type : undefined,
      cycleId: cycleId && isValidObjectId(cycleId) ? cycleId : undefined,
    };

    if (txData.type === "income") {
      txData.remainingAmount = amt;
    }

    const tx = await Transaction.create(txData);

    // 7. Cycle & Allocation Logic
    if (tx.cycleId) {
      if (tx.type === "income") {
        await RecurringCycle.findByIdAndUpdate(tx.cycleId, {
          $inc: { receivedAmount: tx.amount }
        });
      } else if (tx.type === "expense") {
        // FIFO Allocation Logic
        let amountToAllocate = tx.amount;
        const availableIncomes = await Transaction.find({
          cycleId: tx.cycleId,
          type: "income",
          remainingAmount: { $gt: 0 }
        }).sort({ date: 1, createdAt: 1 }); // oldest first

        for (const incTx of availableIncomes) {
          if (amountToAllocate <= 0) break;

          const toAllocate = Math.min(amountToAllocate, incTx.remainingAmount);
          amountToAllocate -= toAllocate;
          
          incTx.remainingAmount -= toAllocate;
          await incTx.save();

          await Allocation.create({
            expenseTxId: tx._id,
            incomeTxId: incTx._id,
            amountAllocated: toAllocate
          });
        }
      }
    }

    return res.status(201).json(tx);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/transactions error:", err);
    return res.status(500).json({ error: err.message || "Failed to create transaction" });
  }
});

router.get("/", async (req, res) => {
  try {
    const txs = await Transaction.find({})
      .sort({ date: -1, createdAt: -1 })
      .populate("from", "name type mode")
      .populate("to", "name type mode")
      .lean();
    return res.json(txs);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/transactions error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch transactions" });
  }
});

// GET /api/transaction/:id/usage
router.get("/:id/usage", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, "Invalid transaction id");

    const tx = await Transaction.findById(id).lean();
    if (!tx) return notFound(res, "Transaction not found");

    const usageTxs = await Transaction.find({ sourceTransactionId: id })
      .sort({ date: -1, createdAt: -1 })
      .populate("to", "name type")
      .lean();

    const map = new Map();
    for (const utx of usageTxs) {
      const to = utx.to;
      const entityId = String(to?._id ?? utx.to);
      const entityName = to?.name ?? "Unknown";
      if (!map.has(entityId)) {
        map.set(entityId, { entityId, entityName, totalAmount: 0, transactions: [] });
      }
      const group = map.get(entityId);
      group.totalAmount += utx.amount;
      group.transactions.push({
        amount: utx.amount,
        date: utx.date,
        title: utx.title,
        note: utx.note,
      });
    }

    return res.json(Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/transactions/:id/usage error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch usage" });
  }
});

// GET /api/transaction/monthly-expenses
router.get("/monthly-expenses", async (req, res) => {
  try {
    const { month } = req.query; // Expecting YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "month parameter YYYY-MM is required" });
    }

    const expenseEntities = await Entity.find({ type: "expense" }).select("_id").lean();
    const expenseIds = expenseEntities.map((e) => e._id);

    const [yearStr, monthStr] = month.split("-");
    const startDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    const endDate = new Date(Number(yearStr), Number(monthStr), 1);

    const txs = await Transaction.find({
      to: { $in: expenseIds },
      date: { $gte: startDate, $lt: endDate }
    })
      .sort({ date: -1, createdAt: -1 })
      .populate("to", "name type")
      .lean();

    let totalSpent = 0;
    const map = new Map();
    
    for (const t of txs) {
      totalSpent += t.amount;
      const entityId = String(t.to?._id || t.to);
      const entityName = t.to?.name || "Unknown";

      if (!map.has(entityId)) {
        map.set(entityId, { entityName, amount: 0 });
      }
      map.get(entityId).amount += t.amount;
    }

    const breakdown = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    return res.json({ totalSpent, breakdown });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/transactions/monthly-expenses error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch monthly expenses" });
  }
});

module.exports = router;

