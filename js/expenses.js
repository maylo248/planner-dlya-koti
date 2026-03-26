/**
 * expenses.js — Rent & Utilities Data Model
 */

export const EXPENSE_CATEGORIES = {
  housing: '🏠 Жилье',
  utility: '⚡ Коммуналка',
  other:   '📦 Другое',
};

export const DEFAULT_EXPENSES = [
  { id: 'rent',     label: 'Аренда квартиры',  amount: 0, category: 'housing', fixed: false },
  { id: 'elec',     label: 'Электричество',         amount: 0, category: 'utility', fixed: false },
  { id: 'water',    label: 'Вода',              amount: 0, category: 'utility', fixed: false },
  { id: 'gas',      label: 'Газ',               amount: 0, category: 'utility', fixed: false },
  { id: 'internet', label: 'Интернет',          amount: 0, category: 'utility', fixed: false },
  { id: 'phone',    label: 'Телефон',           amount: 0, category: 'utility', fixed: false },
];

const STORAGE_KEY = 'planyr-expenses-v1';

/** Load expenses from localStorage, or return defaults */
export function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return DEFAULT_EXPENSES.map(def => {
        const match = saved.find(s => s.id === def.id);
        return match ? { ...def, ...match } : { ...def };
      }).concat(
        saved.filter(s => !DEFAULT_EXPENSES.find(d => d.id === s.id))
      );
    }
  } catch(e) {}
  return DEFAULT_EXPENSES.map(e => ({ ...e }));
}

/** Save expenses to localStorage */
export function saveExpenses(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch(e) {}
}

/** Calculate total monthly expenses */
export function calcTotalExpenses(list, days = []) {
  let total = 0;
  for (const e of list) {
    const amount = Number(e.amount) || 0;
    if (e.period) {
      const multiplier = getPeriodMultiplier(e.period, days);
      total += amount * multiplier;
    } else {
      total += amount;
    }
  }
  return total;
}

export function getPeriodMultiplier(period, days = []) {
  const totalDays = days.length || 30;
  const workDays = days.filter(d => d.type && d.type !== 'none' && d.type !== 'off').length || Math.round(totalDays * 5 / 7);
  const offDays = days.filter(d => d.type === 'off').length || Math.round(totalDays * 2 / 7);
  
  switch(period) {
    case 'month': return 1;
    case 'week': return Math.round(totalDays / 7);
    case 'biweek': return Math.round(totalDays / 14);
    case 'day': return totalDays;
    case 'workday': return workDays;
    case 'offday': return offDays;
    case 'x1day': return totalDays;
    case 'x2day': return totalDays * 2;
    case 'x3day': return totalDays * 3;
    default: return 1;
  }
}

export const PERIOD_OPTIONS = [
  { value: 'month', label: '₽/месяц' },
  { value: 'week', label: '₽/неделю' },
  { value: 'biweek', label: '₽/2 недели' },
  { value: 'day', label: '₽/день' },
  { value: 'workday', label: '₽/рабочий день' },
  { value: 'offday', label: '₽/выходной' },
  { value: 'x1day', label: '₽ раз/день' },
  { value: 'x2day', label: '₽ 2р/день' },
  { value: 'x3day', label: '₽ 3р/день' },
];

/** Group expenses by category */
export function groupByCategory(list) {
  const groups = {};
  for (const e of list) {
    const cat = e.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }
  return groups;
}

/** Create a new empty custom expense */
export function createCustomExpense(label = 'Новая строка') {
  return {
    id:       'custom_' + Date.now(),
    label,
    amount:   0,
    category: 'other',
    fixed:    false,
  };
}

/** Create a new math expense with period */
export function createMathExpense(label = 'Матем. строка') {
  return {
    id:       'math_' + Date.now(),
    label,
    amount:   0,
    category: 'other',
    period:   'month',
    isMath:   true,
  };
}
