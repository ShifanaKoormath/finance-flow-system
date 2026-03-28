const mongoose = require("mongoose");

async function connectDb(mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);

  try {
    await mongoose.connection.collection("entities").dropIndex("type_1_name_1");
    // eslint-disable-next-line no-console
    console.log("Dropped legacy globally-locked Entity uniqueness index.");
  } catch (err) {
    // Index missing or already dropped, safe to ignore
  }
}

module.exports = { connectDb };

