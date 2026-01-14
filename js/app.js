import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. CONFIG (REPLACE WITH YOUR ACTUAL KEYS)
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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ==========================================
// 2. STATE & UTILS
// ==========================================
let activeScanner = null, cart = [], allProducts = [], scanLock = false;

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch (e) { console.warn("Audio Context blocked"); }
}

// ==========================================
// 3. UI NAVIGATION
// ==========================================
window.showModule = async function(id) {
    if (activeScanner) {
        try { await activeScanner.stop(); } catch(e){}
        activeScanner = null;
    }

    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });

    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo(0, 0);
    }
    if (id === 'inventory-module') window.renderInventory();
};

// Auth Observer
onAuthStateChanged(auth, (user) => {
    document.getElementById('initial-loader').style.display = 'none';
    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        window.showModule('dashboard');
        onSnapshot(collection(db, "products"), (snap) => {
            allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
    } else {
        document.getElementById('main-header').classList.add('hidden');
        window.showModule('login-screen');
    }
});

// Login/Logout
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pw').value); } 
    catch(err) { alert("Login failed: " + err.message); }
};
document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 4. MODULE LOGIC
// ==========================================

// Inventory CRUD
window.renderInventory = (f = "") => {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    allProducts.filter(p => p.name.toLowerCase().includes(f.toLowerCase())).forEach(p => {
        list.innerHTML += `<div class="list-item">
            <div><b>${p.name}</b><br><small>Stock: ${p.stock} | ₹${p.sell}</small></div>
            <div>
                <button class="btn-secondary" style="padding:5px 10px; margin:0" onclick="window.editStock('${p.id}')">✏️</button>
                <button class="btn-secondary" style="color:red; padding:5px 10px; margin:0 0 0 5px" onclick="window.deleteProd('${p.id}')">🗑️</button>
            </div>
        </div>`;
    });
};
window.filterInventory = () => window.renderInventory(document.getElementById('inventory-search').value);
window.deleteProd = async (id) => { if(confirm("Delete product?")) await deleteDoc(doc(db, "products", id)); };
window.editStock = async (id) => {
    const p = allProducts.find(x => x.id === id);
    const n = prompt("Update stock for " + p.name, p.stock);
    if(n !== null && n !== "") await updateDoc(doc(db, "products", id), { stock: parseInt(n) });
};

// Search & Lookup
window.searchTextLookup = () => {
    const q = document.getElementById('lookup-search').value.toLowerCase();
    const res = document.getElementById('lookup-search-results');
    if(q.length < 1) { res.classList.add('hidden'); return; }
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(q));
    res.innerHTML = matches.map(p => `<div class="list-item" onclick="window.showLookupResult('${p.id}')"><span>${p.name}</span><b>₹${p.sell}</b></div>`).join('');
    res.classList.remove('hidden');
};

window.showLookupResult = (id) => {
    const p = allProducts.find(x => x.id === id);
    if(!p) return;
    const box = document.getElementById('lookup-result');
    const profit = p.sell - p.buy;
    box.innerHTML = `
        <h3 style="color:var(--primary)">${p.name}</h3>
        <p style="font-size:1.8rem; font-weight:800; margin:10px 0;">₹${p.sell}</p>
        <p>In Stock: ${p.stock} units</p>
        <div id="secure-box" class="hidden" style="background:#f1f5f9; padding:15px; border-radius:15px; margin-top:15px; border:1px dashed #4f46e5">
            <p>Buy Price: ₹${p.buy}</p>
            <p style="color:var(--success)">Profit: ₹${profit.toFixed(2)} (${((profit/p.buy)*100).toFixed(1)}%)</p>
        </div>
        <button class="btn-secondary" style="width:100%; margin-top:10px" onclick="document.getElementById('secure-box').classList.toggle('hidden')">Show/Hide Margins</button>
    `;
    box.classList.remove('hidden');
    document.getElementById('lookup-search-results').classList.add('hidden');
    document.getElementById('lookup-search').value = "";
};

window.startLookupScan = async () => {
    activeScanner = new Html5Qrcode("reader-lookup");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (id) => {
        if(scanLock) return; scanLock = true;
        playBeep(); window.showLookupResult(id);
        setTimeout(() => scanLock = false, 2000);
    }).catch(e => alert("Camera error: " + e));
};

// Generator
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
        new QRCode(qrDiv, { text: docRef.id, width: 160, height: 160 });
        document.getElementById('qr-result-container').classList.remove('hidden');
        alert("Success!"); e.target.reset();
    } catch(err) { alert(err.message); }
    btn.innerText = "Generate QR Code"; btn.disabled = false;
};

document.getElementById('download-qr').onclick = () => {
    const canvas = document.querySelector('#qrcode canvas');
    if(canvas) {
        const a = document.createElement('a');
        a.download = 'product-qr.png'; a.href = canvas.toDataURL(); a.click();
    }
};

// Billing
window.startBillingScan = async () => {
    activeScanner = new Html5Qrcode("reader-billing");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (id) => {
        if(scanLock) return; scanLock = true;
        const p = allProducts.find(x => x.id === id);
        if(p) {
            playBeep();
            const ex = cart.find(i => i.id === id);
            if(ex) ex.qty++; else cart.push({ id, name: p.name, price: p.sell, qty: 1 });
            renderCart();
        }
        setTimeout(() => scanLock = false, 1500);
    }).catch(e => alert("Camera error: " + e));
};

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = ""; let total = 0;
    cart.forEach(item => {
        total += (item.price * item.qty);
        tbody.innerHTML += `<tr><td>${item.name}</td><td>${item.qty}</td><td>₹${(item.price * item.qty).toFixed(2)}</td></tr>`;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

document.getElementById('checkout-btn').onclick = () => {
    if(!cart.length) return alert("Cart empty");
    const name = document.getElementById('cust-name').value || "Walking Customer";
    const phone = document.getElementById('cust-phone').value || "N/A";
    const totalText = document.getElementById('bill-total').innerText;
    
    document.getElementById('invoice-print-area').innerHTML = `
        <div style="text-align:center; padding:20px; font-family:sans-serif; color:black">
            <h2 style="margin:0">RAJ CUSTOMER SERVICE POINT</h2>
            <p style="margin:5px">Dhalpal, Tufanganj, Coochbehar | Mob: +91 8972766578</p>
            <hr>
            <div style="text-align:left; font-size:14px">
                <p><b>Name:</b> ${name} | <b>Mob:</b> ${phone}</p>
                <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; text-align:left; margin:15px 0; border-collapse:collapse">
                <tr style="border-bottom:1px solid #000"><th>Item</th><th>Qty</th><th>Total</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
            </table>
            <h3 style="text-align:right">Total: ${totalText}</h3>
            <p style="margin-top:20px">--- Thank You for Visiting ---</p>
        </div>`;
    window.print();
    cart = []; renderCart();
    document.getElementById('cust-name').value = ""; document.getElementById('cust-phone').value = "";
};

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log(err));
    });
}
