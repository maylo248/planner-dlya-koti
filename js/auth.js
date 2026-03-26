/**
 * auth.js — Authentication System
 * Firebase Auth with local fallback
 */

import { isConfigured, auth } from './firebase-init.js';

// Auth state
let currentUser = null;
let authListeners = [];
let firebaseReady = false;
let initPromise = null;

// Firebase Auth functions
let firebaseOnAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, updateProfile, sendPasswordResetEmail;

// Initialize Firebase Auth
async function initFirebase() {
  if (!isConfigured || !auth) return false;
  
  try {
    const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    firebaseOnAuthStateChanged = authModule.onAuthStateChanged;
    signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
    createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
    signOut = authModule.signOut;
    updateProfile = authModule.updateProfile;
    sendPasswordResetEmail = authModule.sendPasswordResetEmail;
    
    // Listen to auth state changes
    firebaseOnAuthStateChanged(auth, (user) => {
      // Always sync currentUser with Firebase state
      currentUser = user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null;
      notifyAuthChange(currentUser);
    });
    
    firebaseReady = true;
    return true;
  } catch (e) {
    console.error('Firebase Auth error:', e);
    return false;
  }
}

// Start initialization
initPromise = initFirebase();

// Wait for Firebase to be ready
export async function waitForAuth() {
  if (!initPromise) return;
  await initPromise;
}

// Get current user - ALWAYS check Firebase first when configured
export async function getCurrentUser() {
  // If Firebase is configured and ready, check Firebase directly
  if (isConfigured && auth && firebaseReady) {
    const user = auth.currentUser;
    if (user) {
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Пользователь'
      };
    }
  }
  // Fall back to local currentUser (for local auth or if Firebase not ready)
  return currentUser;
}

// Check if logged in
export function isLoggedIn() {
  return currentUser !== null && currentUser !== undefined;
}

// Subscribe to auth changes
export function onAuthChange(callback) {
  authListeners.push(callback);
  // Call immediately if we have a user (Firebase ready or not)
  if (currentUser !== null) {
    callback(currentUser);
  }
}

function notifyAuthChange(user) {
  authListeners.forEach(cb => cb(user));
}

// ============== LOGIN ==============

export async function login(email, password) {
  await waitForAuth();
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
  await waitForAuth();
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
  await waitForAuth();
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

// ============== LOCAL FALLBACK ==============

function loginLocal(email, password) {
  try {
    const raw = localStorage.getItem('planyr-auth-local');
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
    saveLocalAuth(currentUser);
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка входа' };
  }
}

function registerLocal(email, password, displayName) {
  try {
    const raw = localStorage.getItem('planyr-auth-local');
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
    saveLocalAuth(currentUser);
    localStorage.setItem('planyr-auth-local', JSON.stringify(data));
    
    return { success: true, user: currentUser };
  } catch (e) {
    return { success: false, error: 'Ошибка регистрации' };
  }
}

function logoutLocal() {
  currentUser = null;
  notifyAuthChange(null);
  localStorage.removeItem('planyr-user-data');
  return { success: true };
}

function saveLocalAuth(user) {
  try {
    localStorage.setItem('planyr-user-data', JSON.stringify(user));
  } catch (e) {}
}

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
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/user-disabled': 'Аккаунт заблокирован'
  };
  return messages[code] || 'Произошла ошибка';
}
