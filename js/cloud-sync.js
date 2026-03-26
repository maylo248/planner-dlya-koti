/**
 * cloud-sync.js — Cloud Data Synchronization
 * Syncs localStorage data with Firebase Firestore
 */

import { isConfigured, db } from './firebase-init.js';
import { getCurrentUser, isLoggedIn } from './auth.js';

const SYNC_QUEUE_KEY = 'planyr-sync-queue';
const LAST_SYNC_KEY = 'planyr-last-sync';

// Firebase Firestore imports
let collection, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp;

async function loadFirestore() {
  if (!isConfigured) return;
  const firestore = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  collection = firestore.collection;
  doc = firestore.doc;
  getDoc = firestore.getDoc;
  setDoc = firestore.setDoc;
  updateDoc = firestore.updateDoc;
  onSnapshot = firestore.onSnapshot;
}

loadFirestore();

// Sync status
let syncStatus = 'idle'; // idle, syncing, error
let syncListeners = [];

export function onSyncStatusChange(callback) {
  syncListeners.push(callback);
  callback(syncStatus);
}

function notifySyncStatus(status) {
  syncStatus = status;
  syncListeners.forEach(cb => cb(status));
}

// Get user data collection path
function getUserDataPath() {
  const user = getCurrentUser();
  if (!user) return null;
  return `users/${user.uid}`;
}

// Save data to cloud
export async function saveToCloud(dataType, data) {
  if (!isLoggedIn()) {
    queueForSync(dataType, data);
    return { success: false, offline: true };
  }
  
  if (!isConfigured) {
    return saveLocalUserData(dataType, data);
  }
  
  try {
    const userPath = getUserDataPath();
    if (!userPath) return { success: false, error: 'No user' };
    
    const docRef = doc(db, `${userPath}/${dataType}`);
    await setDoc(docRef, {
      data: data,
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
    }, { merge: true });
    
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    return { success: true };
  } catch (error) {
    console.error('Cloud save error:', error);
    queueForSync(dataType, data);
    return { success: false, error: error.message };
  }
}

// Load data from cloud
export async function loadFromCloud(dataType) {
  if (!isLoggedIn()) {
    return loadLocalUserData(dataType);
  }
  
  if (!isConfigured) {
    return loadLocalUserData(dataType);
  }
  
  try {
    const userPath = getUserDataPath();
    if (!userPath) return null;
    
    const docRef = doc(db, `${userPath}/${dataType}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().data;
    }
    return null;
  } catch (error) {
    console.error('Cloud load error:', error);
    return loadLocalUserData(dataType);
  }
}

// Subscribe to real-time updates
export function subscribeToCloud(dataType, callback) {
  if (!isConfigured || !isLoggedIn()) return () => {};
  
  const userPath = getUserDataPath();
  if (!userPath) return () => {};
  
  const docRef = doc(db, `${userPath}/${dataType}`);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().data);
    }
  });
}

// Queue data for sync when offline
function queueForSync(dataType, data) {
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    queue.push({ dataType, data, timestamp: Date.now() });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

// Process sync queue
export async function processSyncQueue() {
  if (!isLoggedIn()) return;
  
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;
    
    for (const item of queue) {
      await saveToCloud(item.dataType, item.data);
    }
    
    localStorage.setItem(SYNC_QUEUE_KEY, '[]');
  } catch (e) {}
}

// Local user data storage (with user isolation)
function getLocalUserKey(dataType) {
  const user = getCurrentUser();
  const userId = user ? btoa(user.email).replace(/[^a-zA-Z0-9]/g, '') : 'guest';
  return `planyr-userdata-${userId}-${dataType}`;
}

function saveLocalUserData(dataType, data) {
  try {
    const key = getLocalUserKey(dataType);
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function loadLocalUserData(dataType) {
  try {
    const key = getLocalUserKey(dataType);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Export data for backup
export async function exportAllUserData() {
  const dataTypes = ['settings', 'days', 'tasks', 'expenses', 'bonuses', 'dayNotes'];
  const exportData = {
    exported: new Date().toISOString(),
    version: '2.0',
    app: 'Планер для коти'
  };
  
  for (const type of dataTypes) {
    const localData = loadLocalUserData(type);
    if (localData) {
      exportData[type] = localData;
    }
  }
  
  return exportData;
}

// Import data from backup
export async function importUserData(data) {
  const dataTypes = ['settings', 'days', 'tasks', 'expenses', 'bonuses', 'dayNotes'];
  
  for (const type of dataTypes) {
    if (data[type]) {
      saveLocalUserData(type, data[type]);
    }
  }
  
  return { success: true };
}
