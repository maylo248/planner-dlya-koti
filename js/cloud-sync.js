/**
 * cloud-sync.js — Cloud Data Synchronization with Firebase Firestore
 * 
 * Структура данных в Firestore:
 * users/{uid}/
 *   profile/         - Профиль пользователя
 *   settings/        - Настройки (rates, taxes, labels, workTypes, etc.)
 *   days/            - Дни по месяцам (days_2025_1, days_2025_2, etc.)
 *   tasks/           - Задачи
 *   expenses/        - Расходы
 *   bonuses/         - Бонусы
 *   dayNotes/        - Заметки на дни
 */

import { isConfigured, db, auth } from './firebase-init.js';

// Storage keys
const STOR = 'planyr-data-v3';
const STOR_ALL = 'planyr-all-v2';
const STOR_BONUSES = 'planyr-bonuses-v1';
const STOR_DAY_NOTES = 'planyr-day-notes-v1';
const STOR_TASKS = 'planyr-tasks-v2';
const STOR_EXPENSES = 'planyr-expenses-v1';

// Sync status
let syncStatus = 'idle';
let syncListeners = [];
let isSyncing = false;
let lastSyncTime = null;

export function onSyncStatusChange(callback) {
  syncListeners.push(callback);
  callback(syncStatus, lastSyncTime);
}

function notifySyncStatus(status, time = null) {
  syncStatus = status;
  lastSyncTime = time;
  syncListeners.forEach(cb => cb(status, time));
}

// Get user ID
function getUserId() {
  return auth?.currentUser?.uid || null;
}

// Firestore paths
function getDocPath(collection, docId = 'data') {
  const uid = getUserId();
  if (!uid) return null;
  return `users/${uid}/${collection}/${docId}`;
}

// Import Firestore functions dynamically
let doc, getDoc, setDoc, updateDoc, onSnapshot, deleteDoc, collection;

async function loadFirestore() {
  if (!isConfigured || !db) return false;
  try {
    const firestore = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    doc = firestore.doc;
    getDoc = firestore.getDoc;
    setDoc = firestore.setDoc;
    updateDoc = firestore.updateDoc;
    onSnapshot = firestore.onSnapshot;
    deleteDoc = firestore.deleteDoc;
    collection = firestore.collection;
    return true;
  } catch (e) {
    console.error('Failed to load Firestore:', e);
    return false;
  }
}

// Load Firestore on module load
loadFirestore();

// ============== SETTINGS SYNC ==============

export async function syncSettingsToCloud(settings) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const path = getDocPath('settings', 'main');
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing settings:', e);
    return false;
  }
}

export async function loadSettingsFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const path = getDocPath('settings', 'main');
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (e) {
    console.error('Error loading settings from cloud:', e);
    return null;
  }
}

// ============== DAYS SYNC ==============

export async function syncDaysToCloud(year, month, days) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const docId = `days_${year}_${month}`;
    const path = getDocPath('days', docId);
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      year,
      month,
      days,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing days:', e);
    return false;
  }
}

export async function loadDaysFromCloud(year, month) {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const docId = `days_${year}_${month}`;
    const path = getDocPath('days', docId);
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data().days;
    }
    return null;
  } catch (e) {
    console.error('Error loading days from cloud:', e);
    return null;
  }
}

// ============== TASKS SYNC ==============

export async function syncTasksToCloud(tasks) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const path = getDocPath('tasks', 'all');
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      tasks,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing tasks:', e);
    return false;
  }
}

export async function loadTasksFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const path = getDocPath('tasks', 'all');
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data().tasks;
    }
    return null;
  } catch (e) {
    console.error('Error loading tasks from cloud:', e);
    return null;
  }
}

// ============== EXPENSES SYNC ==============

export async function syncExpensesToCloud(expenses) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const path = getDocPath('expenses', 'all');
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      expenses,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing expenses:', e);
    return false;
  }
}

export async function loadExpensesFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const path = getDocPath('expenses', 'all');
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data().expenses;
    }
    return null;
  } catch (e) {
    console.error('Error loading expenses from cloud:', e);
    return null;
  }
}

// ============== BONUSES SYNC ==============

export async function syncBonusesToCloud(bonuses) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const path = getDocPath('bonuses', 'all');
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      bonuses,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing bonuses:', e);
    return false;
  }
}

export async function loadBonusesFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const path = getDocPath('bonuses', 'all');
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data().bonuses;
    }
    return null;
  } catch (e) {
    console.error('Error loading bonuses from cloud:', e);
    return null;
  }
}

// ============== DAY NOTES SYNC ==============

export async function syncDayNotesToCloud(dayNotes) {
  if (!isConfigured || !auth?.currentUser) return false;
  
  try {
    const path = getDocPath('dayNotes', 'all');
    if (!path) return false;
    
    await setDoc(doc(db, path), {
      dayNotes,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Error syncing day notes:', e);
    return false;
  }
}

export async function loadDayNotesFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const path = getDocPath('dayNotes', 'all');
    if (!path) return null;
    
    const docSnap = await getDoc(doc(db, path));
    if (docSnap.exists()) {
      return docSnap.data().dayNotes;
    }
    return null;
  } catch (e) {
    console.error('Error loading day notes from cloud:', e);
    return null;
  }
}

// ============== FULL SYNC ==============

export async function syncAllToCloud(state) {
  if (!isConfigured || !auth?.currentUser || isSyncing) return false;
  
  isSyncing = true;
  notifySyncStatus('syncing');
  
  try {
    await Promise.all([
      syncSettingsToCloud({
        rates: state.rates,
        taxes: state.taxes,
        ndfl: state.ndfl,
        rateTypes: state.rateTypes,
        normHours: state.normHours,
        labels: state.labels,
        workTypes: state.workTypes,
        mode: state.mode
      }),
      syncTasksToCloud(state.tasks || []),
      syncExpensesToCloud(state.expenses || []),
      syncBonusesToCloud(state.bonuses || []),
      syncDayNotesToCloud(state.dayNotes || {})
    ]);
    
    notifySyncStatus('synced', new Date().toISOString());
    isSyncing = false;
    return true;
  } catch (e) {
    console.error('Error syncing all data:', e);
    notifySyncStatus('error');
    isSyncing = false;
    return false;
  }
}

export async function loadAllFromCloud() {
  if (!isConfigured || !auth?.currentUser) return null;
  
  try {
    const [settings, tasks, expenses, bonuses, dayNotes] = await Promise.all([
      loadSettingsFromCloud(),
      loadTasksFromCloud(),
      loadExpensesFromCloud(),
      loadBonusesFromCloud(),
      loadDayNotesFromCloud()
    ]);
    
    return { settings, tasks, expenses, bonuses, dayNotes };
  } catch (e) {
    console.error('Error loading all from cloud:', e);
    return null;
  }
}

// ============== EXPORT/IMPORT ==============

export function exportAllLocalData() {
  const data = {
    exported: new Date().toISOString(),
    version: '3.0',
    app: 'Планер для коти',
    localStorage: {}
  };
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('planyr')) {
      try {
        data.localStorage[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        data.localStorage[key] = localStorage.getItem(key);
      }
    }
  }
  
  return data;
}

export async function importCloudData() {
  const cloudData = await loadAllFromCloud();
  if (!cloudData) return null;
  
  return cloudData;
}

// Get sync status
export function getSyncStatus() {
  return {
    status: syncStatus,
    lastSync: lastSyncTime,
    isConfigured,
    isSyncing
  };
}
