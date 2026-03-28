const express = require("express");
const { Entity } = require("../models/Entity");
const { Group } = require("../models/Group");
const { Transaction } = require("../models/Transaction");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [entities, groups, txs] = await Promise.all([
      Entity.find({ userId: req.user.userId }).sort({ type: 1, name: 1 }).lean(),
      Group.find({ userId: req.user.userId }).sort({ type: 1, name: 1 }).lean(),
      Transaction.find({ userId: req.user.userId }).select("amount from to").lean(),
    ]);

    const received = new Map(); // entityId -> number
    const sent = new Map(); // entityId -> number

    for (const tx of txs) {
      const fromId = String(tx.from);
      const toId = String(tx.to);
      sent.set(fromId, (sent.get(fromId) ?? 0) + tx.amount);
      received.set(toId, (received.get(toId) ?? 0) + tx.amount);
    }

    const groupsMap = new Map(); // groupId -> group structure
    for (const g of groups) {
      groupsMap.set(String(g._id), {
        id: String(g._id),
        name: g.name,
        type: g.type,
        totalValue: 0,
        children: []
      });
    }

    const ungrouped = [];

    for (const e of entities) {
      const id = String(e._id);
      const balance = (received.get(id) ?? 0) - (sent.get(id) ?? 0);

      if (e.groupId) {
        const gid = String(e.groupId);
        if (groupsMap.has(gid)) {
          const g = groupsMap.get(gid);
          g.children.push({ id, name: e.name, value: balance });
          g.totalValue += balance;
        } else {
          ungrouped.push({ id, name: e.name, type: e.type, value: balance });
        }
      } else {
        ungrouped.push({ id, name: e.name, type: e.type, value: balance });
      }
    }

    return res.json({
      groups: Array.from(groupsMap.values()),
      ungrouped
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/balances error:", err);
    return res.status(500).json({ error: err.message || "Failed to calculate balances" });
  }
});

module.exports = router;

