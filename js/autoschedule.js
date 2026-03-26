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
    id: '2x2',
    emoji: '🔄',
    name: '2 на 2',
    desc: '2 дня работа, 2 дня отдых. Цикл.',
    apply: apply2x2,
  },
  {
    id: '5x2',
    emoji: '📅',
    name: '5 на 2',
    desc: '5 дней работа, 2 дня отдых. Неделя.',
    apply: apply5x2,
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

function apply2x2(days, workType) {
  // 2 days work, 2 days off, repeating cycle
  let cycleDay = 0;
  for (const day of days) {
    // Start cycle based on first day of month
    const monthStart = new Date(day.year, day.month, 1).getDay();
    const dayIndex = days.indexOf(day);
    
    // Calculate position in 4-day cycle (2 work, 2 off)
    cycleDay = (dayIndex + (7 - monthStart)) % 4;
    
    if (cycleDay < 2) {
      // Work days
      day.type = workType;
      applyShift(day, 'day');
    } else {
      // Off days
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    }
  }
}

function apply5x2(days, workType) {
  // 5 days work, 2 days off (standard week)
  // Start from any day - find first Sunday or Monday to start the cycle
  for (const day of days) {
    const monthStart = new Date(day.year, day.month, 1).getDay();
    const dayIndex = days.indexOf(day);
    
    // Sunday = 0, adjust so Sunday starts the cycle
    // Day position relative to month's first day
    const dayOfWeek = (monthStart + dayIndex) % 7;
    
    // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek === 6) {
      // Saturday = off
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    } else if (dayOfWeek === 0) {
      // Sunday = off
      day.type = 'off'; day.shift = 'none'; day.start = ''; day.end = ''; day.hours = 0;
    } else {
      // Monday to Friday = work
      day.type = workType;
      applyShift(day, 'day');
    }
  }
}
