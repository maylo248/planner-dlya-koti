/**
 * auth.js — Authentication System
 * Supports Firebase Auth with local fallback
 */

import { isConfigured, auth } from './firebase-init.js';

// Auth state storage
const AUTH_STORAGE_KEY = 'planyr-auth-state';
const USER_DATA_KEY = 'planyr-user-data';

let currentUser = null;
let authListeners = [];
let isFirebaseReady = false;

// Firebase Auth functions
let onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, updateProfile, sendPasswordResetEmail;

// Initialize Firebase Auth
async function initFirebaseAuth() {
  if (!isConfigured || !auth) return false;
  
  try {
    const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    onAuthStateChanged = authModule.onAuthStateChanged;
    signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
    createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
    signOut = authModule.signOut;
    updateProfile = authModule.updateProfile;
    sendPasswordResetEmail = authModule.sendPasswordResetEmail;
    
    // Listen to auth state changes
    onAuthStateChanged(auth, (user) => {
      currentUser = user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null;
      notifyAuthChange(currentUser);
    });
    
    isFirebaseReady = true;
    console.log('✅ Firebase Auth готов');
    return true;
  } catch (e) {
    console.error('❌ Firebase Auth не загрузился:', e);
    return false;
  }
}

// Initialize on module load
initFirebaseAuth();

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Check if logged in
export function isLoggedIn() {
  return currentUser !== null && currentUser !== undefined;
}

// Subscribe to auth changes
export function onAuthChange(callback) {
  authListeners.push(callback);
  if (currentUser !== undefined) {
    callback(currentUser);
  }
}

function notifyAuthChange(user) {
  authListeners.forEach(cb => cb(user));
}

// ============== LOGIN ==============

export async function login(email, password) {
  if (!isConfigured || !auth) {
    return loginLocal(email, password);
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    currentUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName
    };
    notifyAuthChange(currentUser);
    return { success: true, user: currentUser };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// ============== REGISTER ==============

export async function register(email, password, displayName = '') {
  if (!isConfigured || !auth) {
    return registerLocal(email, password, displayName);
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    
    currentUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: displayName || email.split('@')[0]
    };
    notifyAuthChange(currentUser);
    return { success: true, user: currentUser };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// ============== LOGOUT ==============

export async function logout() {
  if (!isConfigured || !auth) {
    return logoutLocal();
  }
  
  try {
    await signOut(auth);
    currentUser = null;
    notifyAuthChange(null);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============== PASSWORD RESET ==============

export async function resetPassword(email) {
  if (!isConfigured || !auth) {
    return { success: false, error: 'Firebase не настроен' };
  }
  
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// ============== LOCAL FALLBACK AUTH ==============

function loginLocal(email, password) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { users: {} };
    
    if (!data.users[email]) {
      return { success: false, error: 'Пользователь не найден' };
    }
    
    const stored = data.users[email];
    if (stored.password !== hashPassword(password)) {
      return { success: false, error: 'Неверный пароль' };
    }
    
    currentUser = { email, displayName: stored.displayName };
    notifyAuthChange(currentUser);
    saveLocalAuthState(currentUser);
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка входа' };
  }
}

function registerLocal(email, password, displayName) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { users: {} };
    
    if (data.users[email]) {
      return { success: false, error: 'Этот email уже зарегистрирован' };
    }
    
    data.users[email] = {
      password: hashPassword(password),
      displayName: displayName || email.split('@')[0],
      created: new Date().toISOString()
    };
    
    currentUser = { email, displayName: data.users[email].displayName };
    notifyAuthChange(currentUser);
    saveLocalAuthState(currentUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка регистрации' };
  }
}

function logoutLocal() {
  currentUser = null;
  notifyAuthChange(null);
  localStorage.removeItem(USER_DATA_KEY);
  return { success: true };
}

function saveLocalAuthState(user) {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  } catch (e) {}
}

function loadLocalAuthState() {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (raw) {
      currentUser = JSON.parse(raw);
      notifyAuthChange(currentUser);
    }
  } catch (e) {}
}

// Load local auth state on init
loadLocalAuthState();

// Simple hash (not secure, just for local storage)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Error messages
function getErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/weak-password': 'Пароль должен быть не менее 6 символов',
    'auth/invalid-email': 'Неверный формат email',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
    'auth/network-request-failed': 'Ошибка сети. Проверьте подключение',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/user-disabled': 'Аккаунт заблокирован'
  };
  return messages[code] || 'Произошла ошибка';
}

// Export auth state info
export function getAuthInfo() {
  return {
    isConfigured,
    isLoggedIn: isLoggedIn(),
    user: currentUser,
    isFirebaseReady
  };
}
