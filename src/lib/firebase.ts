
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "geoattendance-mvp.firebaseapp.com",
  projectId: "geoattendance-mvp",
  databaseURL: "https://geoattendance-mvp-default-rtdb.firebaseio.com/",
  appId: "1:748538165538:web:713d2f92881a85e8331d59",
  storageBucket: "geoattendance-mvp.appspot.com",
  messagingSenderId: "748538165538",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export { app, db };
