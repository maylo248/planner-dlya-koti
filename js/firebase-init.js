/**
 * firebase-init.js — Firebase Configuration
 * 
 * НАСТРОЙКА:
 * 1. Создай проект на https://console.firebase.google.com/
 * 2. Зарегистрируй веб-приложение
 * 3. Скопируй firebaseConfig оттуда
 * 4. Включи Authentication (Email/Password) и Firestore Database
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ⚠️ ЗАМЕНИ ЭТИ ЗНАЧЕНИЯ НА СВОИ ИЗ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Проверка настроек
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
  }
} else {
  console.log('⚠️ Firebase не настроен. Данные сохраняются локально.');
}

export { auth, db, isConfigured, app };
