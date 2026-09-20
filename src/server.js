"use strict";

/**
 * server.js — Entry point. Connects to DB then starts the HTTP server.
 */

// env must be loaded before anything else
require("./config/env");

const app = require("./app");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
    console.log(`[server] Health → http://localhost:${PORT}/api/health`);
  });
}

start();
