import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase-config.js';

// --- GLOBAL NAVIGATION FUNCTION ---
// Attached to window so onclick="" in HTML works
window.showModule = function(moduleId) {
    console.log("Navigating to:", moduleId);
    
    // 1. Find all screens
    const screens = document.querySelectorAll('.screen');
    
    // 2. Remove 'active' from all and hide them
    screens.forEach(s => {
        s.classList.remove('active');
    });

    // 3. Show the requested screen
    const target = document.getElementById(moduleId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    } else {
        console.error("Target screen not found:", moduleId);
    }
};

// --- AUTHENTICATION STATE TRACKER ---
console.log("Auth System Initializing...");

onAuthStateChanged(auth, (user) => {
    const header = document.getElementById('main-header');
    
    if (user) {
        console.log("Status: Admin logged in", user.email);
        // Show app content
        header.classList.remove('hidden');
        showModule('dashboard');
    } else {
        console.log("Status: No user session");
        // Show login screen
        header.classList.add('hidden');
        showModule('login-screen');
    }
});

// --- LOGIN FORM HANDLER ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pw = document.getElementById('login-pw').value;
        
        console.log("Attempting Login...");
        try {
            await signInWithEmailAndPassword(auth, email, pw);
            console.log("Login successful!");
        } catch (error) {
            console.error("Login failed:", error.code);
            alert("Error: " + error.message);
        }
    });
}

// --- LOGOUT HANDLER ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            console.log("Logged out");
            location.reload(); 
        } catch (error) {
            console.error("Logout error", error);
        }
    };
}

// --- CONNECTIVITY MONITOR ---
window.addEventListener('online', () => {
    document.getElementById('offline-indicator').classList.add('hidden');
});
window.addEventListener('offline', () => {
    document.getElementById('offline-indicator').classList.remove('hidden');
});

// --- LOAD SUB-MODULES ---
// We use dynamic imports to ensure ui.js loads even if other files have minor errors
import('./qr-logic.js').catch(err => console.error("QR Logic failed to load", err));
import('./scanner.js').catch(err => console.error("Scanner failed to load", err));
import('./billing.js').catch(err => console.error("Billing failed to load", err));
