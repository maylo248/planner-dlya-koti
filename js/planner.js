/**
 * planner.js — Day/Shift/Type Data & Logic
 * Manages the data model for all days in the planner
 */

export const DAY_TYPES = {
  none:  { label: '—',         emoji: '',   color: 'none'  },
  work1: { label: 'Работа 1',  emoji: '💼', color: 'work1' },
  work2: { label: 'Работа 2',  emoji: '🏢', color: 'work2' },
  both:  { label: 'Обе',       emoji: '⚡', color: 'both'  },
  off:   { label: 'Выходной',  emoji: '🌿', color: 'off'   },
};

export const SHIFT_PRESETS = {
  morning: { label: 'Утро',  emoji: '🌅', start: '06:00', end: '14:00' },
  day:     { label: 'День',  emoji: '☀️', start: '09:00', end: '18:00' },
  evening: { label: 'Вечер', emoji: '🌆', start: '14:00', end: '22:00' },
  night:   { label: 'Ночь',  emoji: '🌙', start: '22:00', end: '06:00' },
  custom:  { label: 'Свой',  emoji: '⏱',  start: '',      end: ''      },
};

export const WEEKDAY_NAMES_UK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const WEEKDAY_LONG_UK  = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
export const MONTH_NAMES_UK   = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];

/** Parse "HH:MM" string → total minutes from midnight */
function timeToMinutes(t) {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Calculate hours between two "HH:MM" times (handles overnight) */
export function calcHours(start, end) {
  if (!start || !end) return 0;
  let s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e <= s) e += 24 * 60; // overnight
  return Math.round((e - s) / 60 * 10) / 10;
}

/** Format hours number → "8h" or "8.5h" */
export function formatHours(h) {
  return h > 0 ? `${h}h` : '—';
}

/**
 * Create a fresh day record
 * @param {number} year
 * @param {number} month  0-indexed
 * @param {number} date
 */
export function createDay(year, month, date) {
  return {
    year,
    month,
    date,
    type:  'none',
    shift: 'none',
    start: '',
    end:   '',
    hours: 0,
    note:  '',
  };
}

/** Build the full days array for a given year+month */
export function buildMonthDays(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(createDay(year, month, d));
  }
  return days;
}

/** ISO key for a day: "2025-03-01" */
export function dayKey(year, month, date) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
}

/** Get preset shift times or custom */
export function getShiftTimes(shiftKey) {
  const preset = SHIFT_PRESETS[shiftKey];
  return preset ? { start: preset.start, end: preset.end } : { start: '', end: '' };
}

/** Apply a shift preset to a day record (mutates) */
export function applyShift(day, shiftKey, customStart, customEnd) {
  day.shift = shiftKey;
  if (shiftKey === 'custom') {
    day.start = customStart || '';
    day.end   = customEnd   || '';
  } else {
    const times = getShiftTimes(shiftKey);
    day.start = times.start;
    day.end   = times.end;
  }
  day.hours = calcHours(day.start, day.end);
}

/** Return the emoji for a shift key */
export function shiftEmoji(shiftKey) {
  return SHIFT_PRESETS[shiftKey]?.emoji || '';
}

/** True if date is Saturday (6) or Sunday (0) */
export function isWeekend(year, month, date) {
  const dow = new Date(year, month, date).getDay();
  return dow === 0 || dow === 6;
}

/** Get day-of-week index (0=Sun) */
export function getDow(year, month, date) {
  return new Date(year, month, date).getDay();
}
