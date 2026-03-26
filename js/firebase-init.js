/**
 * Firebase Configuration
 * 
 * TO SET UP FIREBASE:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project
 * 3. Add a web app to the project
 * 4. Copy the firebaseConfig object below
 * 5. Enable Authentication (Email/Password) in Firebase Console
 * 6. Enable Firestore Database in Firebase Console
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Replace this config with your own from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if Firebase is configured
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db, isConfigured };
