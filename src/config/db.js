"use strict";

/**
 * db.js — Connect to MongoDB via Mongoose.
 * Retries are handled by the Mongoose reconnect logic.
 */

const mongoose = require("mongoose");
const { MONGODB_URI } = require("./env");

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("[db] MongoDB connected:", mongoose.connection.host);
  } catch (err) {
    console.error("[db] Connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
