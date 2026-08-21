// 1. Create a Firebase project.
// 2. Enable Realtime Database.
// 3. Replace every value below with your Firebase web app configuration.
const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_PROJECT",
  storageBucket: "PASTE_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
if (firebaseConfig.apiKey !== "PASTE_API_KEY_HERE") firebase.initializeApp(firebaseConfig);
