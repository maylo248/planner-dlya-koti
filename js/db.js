/**
 * db.js — Stable Database Layer
 * Handles all data persistence with error handling and cloud sync
 */

import { saveToCloud, loadFromCloud, processSyncQueue } from './cloud-sync.js';
import { isLoggedIn } from './auth.js';

const DB_VERSION = 'v3';
const PREFIX = 'planyr-db-';

// Storage keys
const KEYS = {
  SETTINGS: `${PREFIX}settings-${DB_VERSION}`,
  DAYS_PREFIX: `${PREFIX}days-`,
  TASKS: `${PREFIX}tasks-v2`,
  EXPENSES: `${PREFIX}expenses-v1`,
  BONUSES: `${PREFIX}bonuses-v1`,
  DAY_NOTES: `${PREFIX}day-notes-v1`,
};

// Error handling wrapper
function safeGetItem(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return defaultValue;
  }
}

function safeSetItem(key, value) {
  try {
    const data = JSON.stringify(value);
    localStorage.setItem(key, data);
    return true;
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
    if (e.name === 'QuotaExceededError') {
      alert('Хранилище заполнено! Удалите старые данные или экспортируйте резервную копию.');
    }
    return false;
  }
}

// Settings
export function loadSettings() {
  return safeGetItem(KEYS.SETTINGS, {});
}

export function saveSettings(settings) {
  const success = safeSetItem(KEYS.SETTINGS, settings);
  if (success && isLoggedIn()) {
    saveToCloud('settings', settings);
  }
  return success;
}

// Days data
function getDaysKey(year, month) {
  return `${KEYS.DAYS_PREFIX}${year}-${month}`;
}

export function loadDays(year, month) {
  return safeGetItem(getDaysKey(year, month), null);
}

export function saveDays(year, month, days) {
  const success = safeSetItem(getDaysKey(year, month), days);
  if (success && isLoggedIn()) {
    saveToCloud(`days-${year}-${month}`, days);
  }
  return success;
}

export function loadAllDays() {
  const result = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEYS.DAYS_PREFIX)) {
      const data = safeGetItem(key);
      if (data) {
        result[key.replace(KEYS.DAYS_PREFIX, '')] = data;
      }
    }
  }
  return result;
}

// Tasks
export function loadTasks() {
  return safeGetItem(KEYS.TASKS, []);
}

export function saveTasks(tasks) {
  const success = safeSetItem(KEYS.TASKS, tasks);
  if (success && isLoggedIn()) {
    saveToCloud('tasks', tasks);
  }
  return success;
}

// Expenses
export function loadExpenses() {
  return safeGetItem(KEYS.EXPENSES, []);
}

export function saveExpenses(expenses) {
  const success = safeSetItem(KEYS.EXPENSES, expenses);
  if (success && isLoggedIn()) {
    saveToCloud('expenses', expenses);
  }
  return success;
}

// Bonuses
export function loadBonuses() {
  return safeGetItem(KEYS.BONUSES, []);
}

export function saveBonuses(bonuses) {
  const success = safeSetItem(KEYS.BONUSES, bonuses);
  if (success && isLoggedIn()) {
    saveToCloud('bonuses', bonuses);
  }
  return success;
}

// Day Notes
export function loadDayNotes() {
  return safeGetItem(KEYS.DAY_NOTES, {});
}

export function saveDayNotes(dayNotes) {
  const success = safeSetItem(KEYS.DAY_NOTES, dayNotes);
  if (success && isLoggedIn()) {
    saveToCloud('dayNotes', dayNotes);
  }
  return success;
}

// Clear all data
export function clearAllData() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (e) {
    console.error('Error clearing data:', e);
    return false;
  }
}

// Export all data
export function exportAllData() {
  return {
    exported: new Date().toISOString(),
    version: DB_VERSION,
    settings: loadSettings(),
    allDays: loadAllDays(),
    tasks: loadTasks(),
    expenses: loadExpenses(),
    bonuses: loadBonuses(),
    dayNotes: loadDayNotes(),
  };
}

// Import data
export function importData(data) {
  try {
    if (data.settings) saveSettings(data.settings);
    if (data.tasks) saveTasks(data.tasks);
    if (data.expenses) saveExpenses(data.expenses);
    if (data.bonuses) saveBonuses(data.bonuses);
    if (data.dayNotes) saveDayNotes(data.dayNotes);
    if (data.allDays) {
      Object.entries(data.allDays).forEach(([key, days]) => {
        const [year, month] = key.split('-');
        saveDays(parseInt(year), parseInt(month), days);
      });
    }
    return true;
  } catch (e) {
    console.error('Error importing data:', e);
    return false;
  }
}

// Sync with cloud on login
export async function syncOnLogin() {
  if (!isLoggedIn()) return;
  
  await processSyncQueue();
  
  // Load cloud data and merge with local
  const cloudSettings = await loadFromCloud('settings');
  if (cloudSettings) {
    const localSettings = loadSettings();
    // Merge: cloud data takes precedence
    const merged = { ...localSettings, ...cloudSettings };
    saveSettings(merged);
  }
}

// Get storage usage
export function getStorageInfo() {
  let used = 0;
  let count = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      const value = localStorage.getItem(key);
      used += key.length + value.length;
      count++;
    }
  }
  
  // Estimate limit (5MB typical)
  const limit = 5 * 1024 * 1024;
  const percent = (used / limit * 100).toFixed(2);
  
  return {
    used: (used / 1024).toFixed(1) + ' KB',
    limit: (limit / 1024 / 1024).toFixed(0) + ' MB',
    percent: percent + '%',
    count
  };
}
