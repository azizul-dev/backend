const mongoose = require("mongoose");
const User = require("./src/models/User");
const { MONGODB_URI } = require("./src/config/env");
mongoose.connect(MONGODB_URI).then(async () => {
  await User.deleteMany({ role: { $ne: "admin" } });
  console.log("Cleared users");
  process.exit(0);
});
