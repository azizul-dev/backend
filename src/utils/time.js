"use strict";

/**
 * time.js — All date/time helpers locked to Asia/Dhaka timezone.
 *
 * Rules (from spec):
 *  - Never use toISOString().slice(0,10)
 *  - Always use server time, never client time
 *  - Use Intl.DateTimeFormat with timeZone "Asia/Dhaka"
 */

const TZ = "Asia/Dhaka";

// Internal formatter helpers
const _dateParts = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

/**
 * dhakaDate(date?) → "YYYY-MM-DD" string in Dhaka timezone.
 * @param {Date} [date] — defaults to now
 */
function dhakaDate(date = new Date()) {
  // en-CA locale formats as YYYY-MM-DD natively
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * dhakaMinutes(date?) → minutes since midnight in Dhaka timezone.
 * Useful for comparing shift boundaries.
 * @param {Date} [date] — defaults to now
 */
function dhakaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const h = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return h * 60 + m;
}

/**
 * dhakaWeekday(date?) → full weekday name in English for Dhaka tz.
 * e.g. "Friday", "Saturday", "Sunday"
 * @param {Date} [date] — defaults to now
 */
function dhakaWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
  }).format(date);
}

/**
 * listDates(fromStr, toStr) → array of "YYYY-MM-DD" strings inclusive.
 * @param {string} fromStr — "YYYY-MM-DD"
 * @param {string} toStr   — "YYYY-MM-DD"
 */
function listDates(fromStr, toStr) {
  const results = [];
  // Parse as local-midnight by appending T00:00:00 to avoid timezone shift
  const cur = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);

  while (cur <= end) {
    results.push(dhakaDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return results;
}

module.exports = { dhakaDate, dhakaMinutes, dhakaWeekday, listDates };
