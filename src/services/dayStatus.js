"use strict";

function computeDayStatus(dateStr, user, attendanceRecord, leaveRecord, isHoliday, isWeeklyOff, isFuture) {
  if (isFuture) return "future";
  if (attendanceRecord) {
    return attendanceRecord.status; // "present" or "late"
  }
  if (leaveRecord) return "leave";
  if (isHoliday) return "holiday";
  if (isWeeklyOff) return "weekly_off";
  
  return "absent";
}

module.exports = { computeDayStatus };
