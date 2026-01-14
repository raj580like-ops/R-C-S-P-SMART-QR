import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCABFo3Whsb3kFbfCiLU4jH4TPJjc-_3Yk",
  authDomain: "r-c-s-p-qr.firebaseapp.com",
  projectId: "r-c-s-p-qr",
  storageBucket: "r-c-s-p-qr.firebasestorage.app",
  messagingSenderId: "851473499622",
  appId: "1:851473499622:web:be694ec06ba10d21148227"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        console.warn("The current browser does not support all of the features required to enable persistence");
    }
});

export { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc };
