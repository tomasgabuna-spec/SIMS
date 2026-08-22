// Firebase Web App configuration for the SIMS project.
// This uses the Firebase v10 compat SDK loaded in index.html.
const firebaseConfig = {
  apiKey: "AIzaSyCqy-TqB-iKc3yo3CX1iB-IZ7dz7gpXz8Q",
  authDomain: "sims-2b6a0.firebaseapp.com",
  projectId: "sims-2b6a0",
  storageBucket: "sims-2b6a0.firebasestorage.app",
  messagingSenderId: "1051673313630",
  appId: "1:1051673313630:web:894c1127604ebe31258fcf"
};

// Initialize Firebase when the compat SDK is available.
if (window.firebase && firebase.apps && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
