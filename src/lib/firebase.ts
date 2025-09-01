
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  projectId: "geoattendance-mvp",
  appId: "1:735578389641:web:9422aa71efbf9e709ada58",
  apiKey: "AIzaSyCtBjG85YxZTqyaJ4oKTZF2MUPrdgASadA",
  authDomain: "geoattendance-mvp.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "735578389641",
  databaseURL: "https://geoattendance-mvp-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export { app, db };
