const mongoose = require("mongoose");
const User = require("./src/models/User");
const { MONGODB_URI } = require("./src/config/env");
mongoose.connect(MONGODB_URI).then(async () => {
  try {
    await User.collection.dropIndex("email_1");
    console.log("Index dropped");
  } catch(e) {
    console.log("Index not found or error:", e.message);
  }
  process.exit(0);
});
