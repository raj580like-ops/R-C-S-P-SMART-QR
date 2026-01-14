import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIG
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
// 2. AUDIO & UTILS
// ==========================================
// Generates a professional beep sound
function playBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

// Show a quick message on screen
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:30px; z-index:10001; font-size:14px;";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// ==========================================
// 3. GLOBAL UI & NAVIGATION
// ==========================================
let activeScanner = null;
let cart = [];
let isScanning = false; // Prevents double scanning

window.showModule = async function(moduleId) {
    if (activeScanner) {
        try { await activeScanner.stop(); } catch(e) {}
        activeScanner = null;
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(moduleId);
    if (target) target.classList.add('active');
};

onAuthStateChanged(auth, (user) => {
    document.getElementById('initial-loader').style.display = 'none';
    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        window.showModule('dashboard');
    } else {
        document.getElementById('main-header').classList.add('hidden');
        window.showModule('login-screen');
    }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pw').value);
    } catch (err) { alert(err.message); }
});

document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 4. QR GENERATOR
// ==========================================
const productForm = document.getElementById('product-form');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = productForm.querySelector('button');
        btn.innerText = "Saving..."; btn.disabled = true;

        const data = {
            name: document.getElementById('p-name').value,
            buy: parseFloat(document.getElementById('p-buy').value),
            sell: parseFloat(document.getElementById('p-sell').value),
            stock: parseInt(document.getElementById('p-stock').value),
            category: document.getElementById('p-cat').value || "General",
            createdAt: serverTimestamp()
        };

        try {
            const docRef = await addDoc(collection(db, "products"), data);
            const qrBox = document.getElementById('qrcode');
            qrBox.innerHTML = "";
            new QRCode(qrBox, { text: docRef.id, width: 160, height: 160 });
            document.getElementById('qr-result-container').classList.remove('hidden');
            showToast("Product Created!");
            productForm.reset();
        } catch (err) { alert(err.message); }
        btn.innerText = "Save & Generate QR"; btn.disabled = false;
    });
}

// ==========================================
// 5. SCANNER: LOOKUP MODULE (Price Check)
// ==========================================
window.startLookupScan = async function() {
    if (activeScanner) await activeScanner.stop();
    activeScanner = new Html5Qrcode("reader-lookup");
    isScanning = false;

    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        async (id) => {
            if (isScanning) return; // Ignore if already processing
            isScanning = true;

            try {
                const snap = await getDoc(doc(db, "products", id));
                if (snap.exists()) {
                    playBeep();
                    const p = snap.data();
                    const res = document.getElementById('lookup-result');
                    res.innerHTML = `<h3 style="color:var(--primary)">${p.name}</h3><p><b>Price:</b> ₹${p.sell}</p><p><b>Stock:</b> ${p.stock}</p>`;
                    res.classList.remove('hidden');
                    showToast("Product Found");
                }
            } catch (e) { console.error(e); }
            
            // Allow scanning again after 2 seconds
            setTimeout(() => { isScanning = false; }, 2000);
        }
    );
};

// ==========================================
// 6. SCANNER: BILLING MODULE (Cart Logic)
// ==========================================
window.startBillingScan = async function() {
    if (activeScanner) await activeScanner.stop();
    activeScanner = new Html5Qrcode("reader-billing");
    isScanning = false;

    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        async (id) => {
            if (isScanning) return; // Prevent rapid-fire adding
            isScanning = true;

            try {
                const snap = await getDoc(doc(db, "products", id));
                if (snap.exists()) {
                    const p = snap.data();
                    const existing = cart.find(i => i.id === id);
                    if (existing) {
                        existing.qty++;
                    } else {
                        cart.push({ id, name: p.name, price: p.sell, qty: 1 });
                    }
                    
                    playBeep(); // Audio Feedback
                    showToast(`Added: ${p.name}`); // Visual Feedback
                    renderCart();
                } else {
                    showToast("Error: Product not found");
                }
            } catch (e) { console.error(e); }

            // Lock scanner for 1.5 seconds so it doesn't add 10 items at once
            setTimeout(() => { isScanning = false; }, 1500);
        }
    ).catch(e => alert("Camera error: " + e));
};

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        tbody.innerHTML += `
            <tr>
                <td style="padding:10px">${item.name}</td>
                <td>
                    <button onclick="window.updateQty(${index}, -1)" style="padding:2px 8px">-</button>
                    ${item.qty}
                    <button onclick="window.updateQty(${index}, 1)" style="padding:2px 8px">+</button>
                </td>
                <td>₹${item.price}</td>
                <td>₹${(item.price * item.qty).toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

window.updateQty = function(index, change) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    renderCart();
};

document.getElementById('checkout-btn').onclick = () => {
    if (cart.length === 0) return alert("Cart is empty");
    const name = document.getElementById('cust-name').value || "Guest";
    const phone = document.getElementById('cust-phone').value || "N/A";
    
    document.getElementById('invoice-print-area').innerHTML = `
        <div style="text-align:center; padding:20px; font-family:sans-serif">
            <h2>RAJ CUSTOMER SERVICE POINT</h2>
            <p>Dhalpal, Tufanganj, Coochbehar | +91 8972766578</p>
            <hr>
            <div style="text-align:left">
                <p><b>Name:</b> ${name} | <b>Mob:</b> ${phone}</p>
                <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; text-align:left; margin:15px 0">
                <tr style="border-bottom:1px solid #000"><th>Item</th><th>Qty</th><th>Total</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
            </table>
            <h3 style="text-align:right">Total: ${document.getElementById('bill-total').innerText}</h3>
            <p>Thank You!</p>
        </div>
    `;
    window.print();
    cart = []; renderCart();
};
