import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase-config.js';

console.log("UI.js Loaded");

// 1. SCREEN NAVIGATION
window.showModule = function(moduleId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    
    const target = document.getElementById(moduleId);
    if (target) {
        target.classList.add('active');
    }
};

// 2. AUTH OBSERVER (This hides the login screen automatically if logged in)
onAuthStateChanged(auth, (user) => {
    // Hide the initial loader if you added it
    const loader = document.getElementById('initial-loader');
    if (loader) loader.style.display = 'none';

    if (user) {
        console.log("Logged in as:", user.email);
        document.getElementById('main-header').classList.remove('hidden');
        showModule('dashboard');
    } else {
        console.log("No user found, showing login.");
        document.getElementById('main-header').classList.add('hidden');
        showModule('login-screen');
    }
});

// 3. LOGIN FORM HANDLER
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show a visual hint that something is happening
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Authenticating...";
        btn.disabled = true;

        const email = document.getElementById('login-email').value;
        const pw = document.getElementById('login-pw').value;

        try {
            await signInWithEmailAndPassword(auth, email, pw);
            console.log("Login Success!");
        } catch (error) {
            console.error("Login Error:", error.code);
            alert("Login Failed: " + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// 4. LOGOUT
document.getElementById('logout-btn').onclick = () => signOut(auth);
