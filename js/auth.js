/**
 * auth.js — Authentication System
 * Supports Firebase Auth and local fallback
 */

import { isConfigured, auth, db } from './firebase-init.js';

const AUTH_STATE_KEY = 'planyr-auth-v1';
const USER_DATA_KEY = 'planyr-user-v1';

let currentUser = null;
let authListeners = [];

// Firebase Auth imports (dynamic)
let onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile;

async function loadFirebaseAuth() {
  if (!isConfigured) return;
  const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  onAuthStateChanged = authModule.onAuthStateChanged;
  signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
  createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
  signOut = authModule.signOut;
  updateProfile = authModule.updateProfile;
}

loadFirebaseAuth();

export function getCurrentUser() {
  return currentUser;
}

export function isLoggedIn() {
  return currentUser !== null && currentUser !== undefined;
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (currentUser !== undefined) {
    callback(currentUser);
  }
}

function notifyAuthChange(user) {
  currentUser = user;
  authListeners.forEach(cb => cb(user));
}

// Firebase Auth
export async function initFirebaseAuth() {
  if (!isConfigured) {
    currentUser = loadLocalUser();
    notifyAuthChange(currentUser);
    return;
  }
  
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    notifyAuthChange(user);
  });
}

export async function login(email, password) {
  if (!isConfigured) {
    return loginLocal(email, password);
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

export async function register(email, password, displayName = '') {
  if (!isConfigured) {
    return registerLocal(email, password, displayName);
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

export async function logout() {
  if (!isConfigured) {
    return logoutLocal();
  }
  
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Local Storage Fallback Auth
function loadLocalUser() {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.loggedIn && data.user) {
        return { email: data.user.email, displayName: data.user.displayName };
      }
    }
  } catch (e) {}
  return null;
}

function loginLocal(email, password) {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    const data = raw ? JSON.parse(raw) : { users: {} };
    
    if (!data.users[email]) {
      return { success: false, error: 'Пользователь не найден' };
    }
    
    const stored = data.users[email];
    if (stored.password !== hashPassword(password)) {
      return { success: false, error: 'Неверный пароль' };
    }
    
    data.loggedIn = true;
    data.user = { email, displayName: stored.displayName };
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(data));
    currentUser = { email, displayName: stored.displayName };
    notifyAuthChange(currentUser);
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка входа' };
  }
}

function registerLocal(email, password, displayName) {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    const data = raw ? JSON.parse(raw) : { users: {} };
    
    if (data.users[email]) {
      return { success: false, error: 'Пользователь уже существует' };
    }
    
    data.users[email] = {
      password: hashPassword(password),
      displayName: displayName || email.split('@')[0],
      created: new Date().toISOString()
    };
    data.loggedIn = true;
    data.user = { email, displayName: data.users[email].displayName };
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(data));
    currentUser = { email, displayName: data.users[email].displayName };
    notifyAuthChange(currentUser);
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка регистрации' };
  }
}

function logoutLocal() {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.loggedIn = false;
      data.user = null;
      localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(data));
    }
    currentUser = null;
    notifyAuthChange(null);
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Ошибка выхода' };
  }
}

// Simple password hashing (not secure, just for local storage)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function getErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/weak-password': 'Пароль должен быть не менее 6 символов',
    'auth/invalid-email': 'Неверный формат email',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
    'auth/network-request-failed': 'Ошибка сети. Проверьте подключение',
  };
  return messages[code] || 'Произошла ошибка';
}
