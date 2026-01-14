import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION (REPLACE THIS!)
// ==========================================
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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ==========================================
// 2. GLOBAL NAVIGATION & UI
// ==========================================
window.showModule = function(moduleId) {
    console.log("Navigating to:", moduleId);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(moduleId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
};

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.style.display = 'none';

    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        showModule('dashboard');
    } else {
        document.getElementById('main-header').classList.add('hidden');
        showModule('login-screen');
    }
});

// Login Form
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pw = document.getElementById('login-pw').value;
    try {
        await signInWithEmailAndPassword(auth, email, pw);
    } catch (err) { alert("Login Error: " + err.message); }
});

// Logout
document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 3. MODULE 1: QR GENERATOR
// ==========================================
const productForm = document.getElementById('product-form');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // STOPS REDIRECT
        e.stopPropagation();

        const submitBtn = productForm.querySelector('button[type="submit"]');
        submitBtn.innerText = "Saving...";
        submitBtn.disabled = true;

        const pData = {
            name: document.getElementById('p-name').value,
            buy: parseFloat(document.getElementById('p-buy').value),
            sell: parseFloat(document.getElementById('p-sell').value),
            stock: parseInt(document.getElementById('p-stock').value),
            category: document.getElementById('p-cat').value || "General",
            createdAt: serverTimestamp()
        };

        try {
            const docRef = await addDoc(collection(db, "products"), pData);
            
            // Show QR Result
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = ""; 
            new QRCode(qrContainer, {
                text: docRef.id,
                width: 180,
                height: 180
            });

            document.getElementById('qr-result-container').classList.remove('hidden');
            alert("✅ Product Saved and QR Generated!");
            productForm.reset();
            document.getElementById('calc-preview').innerText = "Profit: ₹0.00 | Margin: 0%";
        } catch (err) {
            alert("Firestore Error: " + err.message);
        } finally {
            submitBtn.innerText = "Save & Generate QR";
            submitBtn.disabled = false;
        }
    });
}

// Download QR logic
document.getElementById('download-qr').onclick = () => {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'product-qr.png';
        link.href = canvas.toDataURL();
        link.click();
    }
};

// ==========================================
// 4. MODULE 2 & 3: SCANNER & BILLING
// ==========================================
let cart = [];
let html5QrCode;

window.startBillingScan = async () => {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    
    document.getElementById('reader').style.display = 'block';
    
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
            console.log("Scanned ID:", decodedText);
            await html5QrCode.stop();
            document.getElementById('reader').style.display = 'none';
            addToCart(decodedText);
        }
    ).catch(err => alert("Camera Error: " + err));
};

async function addToCart(id) {
    try {
        const docRef = doc(db, "products", id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const prod = snap.data();
            const existing = cart.find(item => item.id === id);
            if (existing) {
                existing.qty++;
            } else {
                cart.push({ id, name: prod.name, price: prod.sell, qty: 1 });
            }
            renderCart();
        } else {
            alert("Product not found in database.");
        }
    } catch (err) {
        alert("Error fetching product: " + err.message);
    }
}

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
        const rowTotal = item.price * item.qty;
        total += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>₹${item.price}</td>
                <td>₹${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

// Checkout and Print
document.getElementById('checkout-btn').onclick = () => {
    if (cart.length === 0) return alert("Cart is empty");
    
    const name = document.getElementById('cust-name').value || "Walking Customer";
    const phone = document.getElementById('cust-phone').value || "N/A";
    const total = document.getElementById('bill-total').innerText;
    
    const printArea = document.getElementById('invoice-print-area');
    printArea.innerHTML = `
        <div style="text-align:center; font-family: sans-serif;">
            <h2>RAJ CUSTOMER SERVICE POINT</h2>
            <p>Dhalpal, Tufanganj, Coochbehar<br>+91 8972766578</p>
            <hr>
            <p>Customer: ${name} | Mob: ${phone}</p>
            <p>Date: ${new Date().toLocaleString()}</p>
            <table style="width:100%; text-align:left; border-collapse:collapse;">
                <tr style="border-bottom:1px solid #000"><th>Item</th><th>Qty</th><th>Price</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price * i.qty}</td></tr>`).join('')}
            </table>
            <hr>
            <h3 style="text-align:right">Grand Total: ${total}</h3>
            <p style="margin-top:20px">Thank you for visiting!</p>
        </div>
    `;
    window.print();
    cart = [];
    renderCart();
};
