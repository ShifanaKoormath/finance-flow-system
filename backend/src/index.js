const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDb } = require("./db");

const entitiesRouter = require("./routes/entities");
const balancesRouter = require("./routes/balances");
const transactionsRouter = require("./routes/transactions");
const sourcesRouter = require("./routes/sources");
const groupsRouter = require("./routes/groups");
const cyclesRouter = require("./routes/cycles");

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in backend/.env");
  }
  await connectDb(MONGODB_URI);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/entities", entitiesRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/balances", balancesRouter);
  app.use("/api/source", sourcesRouter);
  app.use("/api/cycles", cyclesRouter);

  // NOTE: spec endpoints shown as /api/transaction/:id/usage and /api/source/:id/summary
  // We mounted /api/transactions for list/create and embedded :id/usage there.
  // Add alias route to match exact spec path.
  app.use("/api/transaction", transactionsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

