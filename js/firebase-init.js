/**
 * firebase-init.js — Firebase Configuration
 * 
 * Проект: Планер для коти
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase конфигурация
const firebaseConfig = {
  apiKey: "AIzaSyBSGKkJHlI0zt1p04Np36REcUOWF0ajwRA",
  authDomain: "planerlf-by-motya.firebaseapp.com",
  projectId: "planerlf-by-motya",
  storageBucket: "planerlf-by-motya.firebasestorage.app",
  messagingSenderId: "517966774189",
  appId: "1:517966774189:web:fc41783a0170bc7ef06b24",
  measurementId: "G-Z8ZRF20M8E"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const isConfigured = true;

export { auth, db, isConfigured, app };
