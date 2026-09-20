"use strict";

/**
 * Holiday.js — Office holidays that are never counted as absent.
 */

const mongoose = require("mongoose");

const HolidaySchema = new mongoose.Schema(
  {
    // "YYYY-MM-DD" unique holiday date
    date: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Holiday", HolidaySchema);
