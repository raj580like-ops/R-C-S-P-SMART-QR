import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCABFo3Whsb3kFbfCiLU4jH4TPJjc-_3Yk",
  authDomain: "r-c-s-p-qr.firebaseapp.com",
  databaseURL: "https://r-c-s-p-qr-default-rtdb.firebaseio.com",
  projectId: "r-c-s-p-qr",
  storageBucket: "r-c-s-p-qr.firebasestorage.app",
  messagingSenderId: "851473499622",
  appId: "1:851473499622:web:be694ec06ba10d21148227"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Enable Offline Persistence
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ==========================================
// 2. GLOBAL STATE & UTILS
// ==========================================
let activeScanner = null;
let cart = [];
let allProducts = [];
let scanLock = false;

// Professional Scan Beep (Web Audio API)
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) { console.log("Audio play blocked"); }
}

// ==========================================
// 3. UI NAVIGATION & AUTH
// ==========================================
window.showModule = async function(id) {
    // Cleanup any running scanners
    if (activeScanner) {
        try { await activeScanner.stop(); } catch (e) {}
        activeScanner = null;
    }
    
    // Switch Screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }

    // Module Specific Init
    if (id === 'inventory-module') window.renderInventory();
};

onAuthStateChanged(auth, (user) => {
    document.getElementById('initial-loader').style.display = 'none';
    const header = document.getElementById('main-header');
    
    if (user) {
        header.classList.remove('hidden');
        window.showModule('dashboard');
        
        // Live listener for products (Syncs offline/online data automatically)
        onSnapshot(collection(db, "products"), (snap) => {
            allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log("Products synced:", allProducts.length);
        });
    } else {
        header.classList.add('hidden');
        window.showModule('login-screen');
    }
});

// Auth Handlers
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pw = document.getElementById('login-pw').value;
    try { 
        await signInWithEmailAndPassword(auth, email, pw); 
    } catch (err) { alert("Login Error: " + err.message); }
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 4. INVENTORY MANAGEMENT (CRUD)
// ==========================================
window.renderInventory = function(filter = "") {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    if (filtered.length === 0) {
        list.innerHTML = "<p style='padding:20px; text-align:center'>No products found.</p>";
        return;
    }

    filtered.forEach(p => {
        const item = document.createElement('div');
        item.className = 'product-row';
        item.innerHTML = `
            <div>
                <b>${p.name}</b>
                <small>Stock: ${p.stock} | Price: ₹${p.sell}</small>
            </div>
            <div style="display:flex; gap:10px">
                <button class="btn-secondary" onclick="window.editStock('${p.id}')">✏️</button>
                <button class="btn-secondary" style="color:red" onclick="window.deleteProd('${p.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
};

window.filterInventory = () => {
    window.renderInventory(document.getElementById('inventory-search').value);
};

window.deleteProd = async (id) => {
    if (confirm("Permanently delete this product?")) {
        await deleteDoc(doc(db, "products", id));
    }
};

window.editStock = async (id) => {
    const p = allProducts.find(x => x.id === id);
    const n = prompt(`Update stock for ${p.name}:`, p.stock);
    if (n !== null && n !== "") {
        await updateDoc(doc(db, "products", id), { stock: parseInt(n) });
    }
};

// ==========================================
// 5. LOOKUP & PRICE CHECK
// ==========================================
window.searchTextLookup = () => {
    const q = document.getElementById('lookup-search').value.toLowerCase();
    const res = document.getElementById('lookup-search-results');
    
    if (q.length < 1) { res.classList.add('hidden'); return; }
    
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(q));
    if (matches.length > 0) {
        res.innerHTML = matches.map(p => `
            <div class="product-row" style="cursor:pointer" onclick="window.showLookupResult('${p.id}')">
                <span>${p.name}</span>
                <span style="color:var(--primary); font-weight:800">₹${p.sell}</span>
            </div>
        `).join('');
        res.classList.remove('hidden');
    } else {
        res.innerHTML = "<div style='padding:15px'>No match</div>";
        res.classList.remove('hidden');
    }
};

window.showLookupResult = (id) => {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    
    const profit = p.sell - p.buy;
    const margin = ((profit / p.buy) * 100).toFixed(1);
    
    const box = document.getElementById('lookup-result');
    box.innerHTML = `
        <h3 style="margin-bottom:10px">${p.name}</h3>
        <p style="font-size:1.8rem; color:var(--primary); font-weight:800">₹${p.sell}</p>
        <p style="color:var(--text-muted); margin-bottom:15px">In Stock: ${p.stock} units</p>
        
        <div id="secure-margin-box" class="hidden" style="background:#f1f5f9; padding:15px; border-radius:15px; margin-bottom:15px; border:1px dashed var(--primary)">
            <p style="font-size:0.9rem"><b>Buy Price:</b> ₹${p.buy}</p>
            <p style="font-size:0.9rem; color:var(--success)"><b>Profit:</b> ₹${profit.toFixed(2)} (${margin}%)</p>
        </div>
        
        <button class="btn-secondary" style="width:100%" onclick="document.getElementById('secure-margin-box').classList.toggle('hidden')">
            🔒 Toggle Private Margins
        </button>
    `;
    box.classList.remove('hidden');
    document.getElementById('lookup-search-results').classList.add('hidden');
    document.getElementById('lookup-search').value = "";
};

window.startLookupScan = async () => {
    activeScanner = new Html5Qrcode("reader-lookup");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (id) => {
        if (scanLock) return;
        scanLock = true;
        playBeep();
        window.showLookupResult(id);
        setTimeout(() => scanLock = false, 2000); // 2s cooldown
    }).catch(err => alert("Camera Error: " + err));
};

// ==========================================
// 6. QR GENERATOR
// ==========================================
document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Saving..."; btn.disabled = true;

    const data = {
        name: document.getElementById('p-name').value,
        buy: parseFloat(document.getElementById('p-buy').value),
        sell: parseFloat(document.getElementById('p-sell').value),
        stock: parseInt(document.getElementById('p-stock').value),
        createdAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "products"), data);
        const qrDiv = document.getElementById('qrcode');
        qrDiv.innerHTML = "";
        new QRCode(qrDiv, { text: docRef.id, width: 180, height: 180 });
        document.getElementById('qr-result-container').classList.remove('hidden');
        alert("✅ Product Saved Successfully!");
        e.target.reset();
    } catch (err) { alert("Save Error: " + err.message); }
    
    btn.innerText = "Generate QR Code"; btn.disabled = false;
};

// ==========================================
// 7. BILLING SYSTEM
// ==========================================
window.startBillingScan = async () => {
    activeScanner = new Html5Qrcode("reader-billing");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (id) => {
        if (scanLock) return;
        scanLock = true;
        
        const p = allProducts.find(x => x.id === id);
        if (p) {
            playBeep();
            const existing = cart.find(item => item.id === id);
            if (existing) {
                existing.qty++;
            } else {
                cart.push({ id, name: p.name, price: p.sell, qty: 1 });
            }
            renderCart();
        }
        setTimeout(() => scanLock = false, 1500); // 1.5s cooldown
    }).catch(err => alert("Camera Error: " + err));
};

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = ""; 
    let total = 0;
    
    cart.forEach(item => {
        const rowTotal = item.price * item.qty;
        total += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td style="text-align:center">${item.qty}</td>
                <td style="text-align:right">₹${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

document.getElementById('checkout-btn').onclick = () => {
    if (cart.length === 0) return alert("Cart is empty!");
    
    const name = document.getElementById('cust-name').value || "Walking Customer";
    const phone = document.getElementById('cust-phone').value || "N/A";
    const totalText = document.getElementById('bill-total').innerText;
    
    const printArea = document.getElementById('invoice-print-area');
    printArea.innerHTML = `
        <div style="text-align:center; padding:30px; font-family:sans-serif; color:#000">
            <h2 style="margin:0; font-size:24px">RAJ CUSTOMER SERVICE POINT</h2>
            <p style="margin:5px; font-size:14px">Dhalpal, Tufanganj, Coochbehar<br>Mob: +91 8972766578</p>
            <hr style="border:0; border-top:1px dashed #000; margin:15px 0">
            <div style="text-align:left; font-size:13px">
                <p><b>Customer:</b> ${name}</p>
                <p><b>Phone:</b> ${phone}</p>
                <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; text-align:left; margin:15px 0; font-size:13px; border-collapse:collapse">
                <tr style="border-bottom:1px solid #000">
                    <th style="padding:5px 0">Item</th>
                    <th style="text-align:center">Qty</th>
                    <th style="text-align:right">Price</th>
                </tr>
                ${cart.map(i => `
                    <tr>
                        <td style="padding:5px 0">${i.name}</td>
                        <td style="text-align:center">${i.qty}</td>
                        <td style="text-align:right">₹${(i.price * i.qty).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </table>
            <hr style="border:0; border-top:1px dashed #000">
            <h2 style="text-align:right; margin:10px 0">Total: ${totalText}</h2>
            <p style="margin-top:30px; font-size:12px">--- Thank You for Visiting ---</p>
        </div>
    `;
    
    window.print();
    
    // Clear Cart after successful print
    cart = [];
    renderCart();
    document.getElementById('cust-name').value = "";
    document.getElementById('cust-phone').value = "";
};

// Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log(err));
    });
}
