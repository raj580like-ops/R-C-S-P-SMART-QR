import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from './firebase-config.js';

// Screen management
window.showModule = function(moduleId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(moduleId).classList.remove('hidden');
    
    // Stop scanner if leaving scanner module
    if (moduleId !== 'scanner-module' && window.html5QrCode) {
        window.html5QrCode.stop().catch(() => {});
    }
};

// Login Logic
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pw = document.getElementById('login-pw').value;
        
        signInWithEmailAndPassword(auth, email, pw)
            .catch(err => alert("Login Failed: " + err.message));
    });
}

// Logout Logic
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-header').classList.remove('hidden');
        showModule('dashboard');
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-header').classList.add('hidden');
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    }
});

// Connectivity UI
window.addEventListener('online', () => document.getElementById('offline-indicator').classList.add('hidden'));
window.addEventListener('offline', () => document.getElementById('offline-indicator').classList.remove('hidden'));

// Import logic for other modules
import './qr-logic.js';
import './scanner.js';
import './billing.js';
