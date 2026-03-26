/**
 * autoschedule.js — Auto-Schedule Strategies
 * Generates a month schedule based on chosen strategy
 */

import { applyShift, isWeekend, buildMonthDays, dayKey } from './planner.js';

/**
 * Strategy definitions
 */
export const STRATEGIES = [
  {
    id: 'hustle',
    emoji: '🚀',
    name: 'Быстрые деньги',
    desc: 'Максимум рабочих дней и часов. Выход каждый день.',
    apply: applyHustle,
  },
  {
    id: 'balance',
    emoji: '⚖️',
    name: 'Баланс',
    desc: '5 рабочих + 2 выходных. Дневная смена.',
    apply: applyBalance,
  },
  {
    id: 'easy',
    emoji: '😌',
    name: 'Легкий режим',
    desc: 'Короткие смены, больше свободного времени.',
    apply: applyEasy,
  },
  {
    id: 'maxoff',
    emoji: '🏖',
    name: 'Максимум выходных',
    desc: 'Только 3 рабочих дня в неделю, остальные — выходные.',
    apply: applyMaxOff,
  },
];

/** Apply strategy to array of day records (mutates) */
export function applyStrategy(days, strategyId, workType = 'work1') {
  const strategy = STRATEGIES.find(s => s.id === strategyId);
  if (!strategy) return;
  strategy.apply(days, workType);
}

/* ───────────────────────────────────────────────
   STRATEGY IMPLEMENTATIONS
─────────────────────────────────────────────── */

function applyHustle(days, workType) {
  for (const day of days) {
    const wd = new Date(day.year, day.month, day.date).getDay();
    if (wd === 0) {
      // Sunday = off
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    } else {
      day.type = workType;
      applyShift(day, 'day');
    }
  }
}

function applyBalance(days, workType) {
  // Mon–Fri = work, Sat–Sun = off
  for (const day of days) {
    const wd = new Date(day.year, day.month, day.date).getDay();
    const isOff = wd === 0 || wd === 6;
    if (isOff) {
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    } else {
      day.type = workType;
      applyShift(day, 'day');
    }
  }
}

function applyEasy(days, workType) {
  // Mon/Wed/Fri = morning shift, rest = off
  for (const day of days) {
    const wd = new Date(day.year, day.month, day.date).getDay();
    const isWork = wd === 1 || wd === 3 || wd === 5;
    if (isWork) {
      day.type = workType;
      applyShift(day, 'morning');
    } else {
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    }
  }
}

function applyMaxOff(days, workType) {
  // Only Tue, Thu, Sat = work, rest = off
  for (const day of days) {
    const wd = new Date(day.year, day.month, day.date).getDay();
    const isWork = wd === 2 || wd === 4 || wd === 6;
    if (isWork) {
      day.type = workType;
      applyShift(day, 'day');
    } else {
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    }
  }
}
