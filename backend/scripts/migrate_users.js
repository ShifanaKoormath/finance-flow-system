const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const { connectDb } = require("../src/db");
const { User } = require("../src/models/User");
const { Entity } = require("../src/models/Entity");
const { Transaction } = require("../src/models/Transaction");
const { Group } = require("../src/models/Group");
const { RecurringCycle } = require("../src/models/RecurringCycle");
const { Allocation } = require("../src/models/Allocation");

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in backend/.env");
  }

  await connectDb(MONGODB_URI);
  console.log("Connected to MongoDB");

  const defaultEmail = "admin@flowledger.app";
  let defaultUser = await User.findOne({ email: defaultEmail });

  if (!defaultUser) {
    console.log("Creating default user...");
    const passwordHash = await bcrypt.hash("password123", 10);
    defaultUser = await User.create({
      name: "Default Admin",
      email: defaultEmail,
      passwordHash
    });
    console.log(`Created default user: ${defaultEmail} / password123`);
  } else {
    console.log("Default user already exists");
  }

  const userId = defaultUser._id;

  console.log("Migrating Entities...");
  const entityRes = await Entity.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Updated ${entityRes.modifiedCount} entities`);

  console.log("Migrating Transactions...");
  const txRes = await Transaction.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Updated ${txRes.modifiedCount} transactions`);

  console.log("Migrating Groups...");
  const groupRes = await Group.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Updated ${groupRes.modifiedCount} groups`);

  console.log("Migrating RecurringCycles...");
  const cycleRes = await RecurringCycle.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Updated ${cycleRes.modifiedCount} cycles`);

  console.log("Migrating Allocations...");
  const allocRes = await Allocation.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  console.log(`Updated ${allocRes.modifiedCount} allocations`);

  console.log("Migration completed successfully.");
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
