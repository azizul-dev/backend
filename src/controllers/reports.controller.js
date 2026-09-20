"use strict";

const ExcelJS = require("exceljs");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Holiday = require("../models/Holiday");
const Setting = require("../models/Setting");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { dhakaDate, listDates, dhakaWeekday } = require("../utils/time");
const { computeDayStatus } = require("../services/dayStatus");

const getSummary = asyncHandler(async (req, res) => {
  const dateStr = req.query.date || dhakaDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("Invalid date format (YYYY-MM-DD)", 400, "BAD_REQUEST");
  }

  const users = await User.find({ isActive: true, role: "employee" }).lean();
  const setting = await Setting.findOne();
  const holiday = await Holiday.findOne({ date: dateStr }).lean();
  const attendances = await Attendance.find({ date: dateStr }).lean();
  const leaves = await Leave.find({ status: "approved", fromDate: { $lte: dateStr }, toDate: { $gte: dateStr } }).lean();

  const isWOff = setting && setting.weeklyOff.includes(dhakaWeekday(new Date(`${dateStr}T00:00:00`)));
  const isHol = !!holiday;
  const isFuture = dateStr > dhakaDate();

  const attMap = new Map(attendances.map(a => [String(a.user), a]));
  const leaveSet = new Set(leaves.map(l => String(l.user)));

  const totals = { totalEmployees: users.length, present: 0, late: 0, absent: 0, onLeave: 0 };

  for (const u of users) {
    const att = attMap.get(String(u._id));
    const onLeave = leaveSet.has(String(u._id));
    const st = computeDayStatus(dateStr, u, att, onLeave ? {} : null, isHol, isWOff, isFuture);
    
    if (st === "present") totals.present++;
    else if (st === "late") totals.late++;
    else if (st === "absent") totals.absent++;
    else if (st === "leave") totals.onLeave++;
  }

  return ok(res, totals);
});

const getMonthly = asyncHandler(async (req, res) => {
  const month = req.query.month;
  const format = req.query.format || "json";
  
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError("month query parameter (YYYY-MM) is required", 400, "BAD_REQUEST");
  }
  
  const fromDate = `${month}-01`;
  const [year, m] = month.split('-');
  const daysInMonth = new Date(year, m, 0).getDate();
  const toDate = `${month}-${daysInMonth}`;
  const dates = listDates(fromDate, toDate);
  const todayStr = dhakaDate();

  const users = await User.find({ isActive: true, role: "employee" }).lean();
  const setting = await Setting.findOne();
  const holidays = await Holiday.find({ date: { $gte: fromDate, $lte: toDate } }).lean();
  const attendances = await Attendance.find({ date: { $gte: fromDate, $lte: toDate } }).lean();
  const leaves = await Leave.find({ status: "approved", $or: [
    { fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }
  ] }).lean();

  const holidaySet = new Set(holidays.map(h => h.date));
  const weeklyOffs = setting ? setting.weeklyOff : [];
  
  const reportData = users.map(u => {
    const userAtts = attendances.filter(a => String(a.user) === String(u._id));
    const attMap = new Map(userAtts.map(a => [a.date, a]));
    const userLeaves = leaves.filter(l => String(l.user) === String(u._id));
    
    function isLeaveDay(d) {
      return userLeaves.some(l => d >= l.fromDate && d <= l.toDate);
    }

    const counts = { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, weekly_off: 0, future: 0 };
    let totalWorkingMins = 0;
    
    const daily = dates.map(d => {
      const isFuture = d > todayStr;
      const isWOff = weeklyOffs.includes(dhakaWeekday(new Date(`${d}T00:00:00`)));
      const record = attMap.get(d);
      const st = computeDayStatus(d, u, record, isLeaveDay(d) ? {} : null, holidaySet.has(d), isWOff, isFuture);
      
      counts[st] = (counts[st] || 0) + 1;
      if (record && record.workingMinutes) totalWorkingMins += record.workingMinutes;
      
      return { date: d, status: st };
    });

    return {
      user: { id: u._id, name: u.name, employeeId: u.employeeId },
      daily,
      totals: counts,
      totalWorkingHours: +(totalWorkingMins / 60).toFixed(2)
    };
  });

  if (format === "json") {
    return ok(res, reportData);
  } else if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Summary
    const sumSheet = workbook.addWorksheet("Summary");
    sumSheet.columns = [
      { header: "Employee ID", key: "empId", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Present", key: "present", width: 10 },
      { header: "Late", key: "late", width: 10 },
      { header: "Absent", key: "absent", width: 10 },
      { header: "Leave", key: "leave", width: 10 },
      { header: "Holiday", key: "holiday", width: 10 },
      { header: "Weekly Off", key: "woff", width: 15 },
      { header: "Total Working Hours", key: "hours", width: 20 },
    ];
    
    reportData.forEach(row => {
      sumSheet.addRow({
        empId: row.user.employeeId || "",
        name: row.user.name,
        present: row.totals.present,
        late: row.totals.late,
        absent: row.totals.absent,
        leave: row.totals.leave,
        holiday: row.totals.holiday,
        woff: row.totals.weekly_off,
        hours: row.totalWorkingHours
      });
    });
    
    // Sheet 2: Daily
    const dailySheet = workbook.addWorksheet("Daily");
    const dailyCols = [
      { header: "Employee ID", key: "empId", width: 15 },
      { header: "Name", key: "name", width: 25 }
    ];
    dates.forEach(d => {
      const dayNum = d.split("-")[2];
      dailyCols.push({ header: dayNum, key: `d_${d}`, width: 5 });
    });
    dailySheet.columns = dailyCols;
    
    const codeMap = { present: "P", late: "L", absent: "A", leave: "LV", holiday: "H", weekly_off: "W", future: "-" };
    
    reportData.forEach(row => {
      const r = { empId: row.user.employeeId || "", name: row.user.name };
      row.daily.forEach(day => {
        r[`d_${day.date}`] = codeMap[day.status] || "";
      });
      dailySheet.addRow(r);
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=attendance_${month}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } else {
    throw new AppError("Invalid format", 400, "BAD_REQUEST");
  }
});

module.exports = { getSummary, getMonthly };
