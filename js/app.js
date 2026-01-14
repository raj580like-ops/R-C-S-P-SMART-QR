import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIG
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
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// 2. STATE & UTILS
let activeScanner = null;
let cart = [];
let allProducts = [];
let scanLock = false;

function playBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

// Global Nav
window.showModule = async function(id) {
    if (activeScanner) { try { await activeScanner.stop(); } catch(e){} activeScanner = null; }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'inventory-module') renderInventory();
};

// 3. AUTH LOGIC
onAuthStateChanged(auth, (user) => {
    document.getElementById('initial-loader').style.display = 'none';
    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        window.showModule('dashboard');
        // Watch products in real-time
        onSnapshot(collection(db, "products"), (snap) => {
            allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
    } else {
        document.getElementById('main-header').classList.add('hidden');
        window.showModule('login-screen');
    }
});

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pw').value); }
    catch(err) { alert(err.message); }
};
document.getElementById('logout-btn').onclick = () => signOut(auth);

// 4. INVENTORY LOGIC (CRUD)
function renderInventory(filter = "") {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(p => {
        list.innerHTML += `
            <div class="list-item">
                <div>
                    <h4 style="font-size:0.9rem">${p.name}</h4>
                    <p style="font-size:0.75rem; color:#64748b">Stock: ${p.stock} | ₹${p.sell}</p>
                </div>
                <div style="display:flex; gap:8px">
                    <button class="btn-secondary" style="padding:5px 8px; margin:0" onclick="editStock('${p.id}')">✏️</button>
                    <button class="btn-secondary" style="padding:5px 8px; margin:0; color:red" onclick="deleteProd('${p.id}')">🗑️</button>
                </div>
            </div>`;
    });
}
window.filterInventory = () => renderInventory(document.getElementById('inventory-search').value);
window.deleteProd = async (id) => { if(confirm("Delete product?")) await deleteDoc(doc(db, "products", id)); };
window.editStock = async (id) => {
    const p = allProducts.find(x => x.id === id);
    const n = prompt("New Stock for " + p.name, p.stock);
    if(n !== null) await updateDoc(doc(db, "products", id), { stock: parseInt(n) });
};

// 5. LOOKUP & SEARCH
window.searchTextLookup = () => {
    const q = document.getElementById('lookup-search').value.toLowerCase();
    const res = document.getElementById('lookup-search-results');
    if(q.length < 2) { res.classList.add('hidden'); return; }
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(q));
    res.innerHTML = matches.map(p => `<div class="list-item" onclick="showResult('${p.id}')">${p.name} <small>₹${p.sell}</small></div>`).join('');
    res.classList.remove('hidden');
};

window.showResult = (id) => {
    const p = allProducts.find(x => x.id === id);
    const box = document.getElementById('lookup-result');
    box.innerHTML = `<h3 style="color:var(--primary)">${p.name}</h3><p>Price: <b>₹${p.sell}</b></p><p>Available Stock: ${p.stock}</p>`;
    box.classList.remove('hidden');
    document.getElementById('lookup-search-results').classList.add('hidden');
};

window.startLookupScan = async () => {
    activeScanner = new Html5Qrcode("reader-lookup");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (id) => {
        if(scanLock) return; scanLock = true;
        playBeep(); window.showResult(id);
        setTimeout(() => scanLock = false, 2000);
    });
};

// 6. GENERATOR
document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('p-name').value,
        buy: parseFloat(document.getElementById('p-buy').value),
        sell: parseFloat(document.getElementById('p-sell').value),
        stock: parseInt(document.getElementById('p-stock').value),
        createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, "products"), data);
    const qrDiv = document.getElementById('qrcode');
    qrDiv.innerHTML = "";
    new QRCode(qrDiv, { text: docRef.id, width: 160, height: 160 });
    document.getElementById('qr-result-container').classList.remove('hidden');
    e.target.reset();
};

// 7. BILLING
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
    });
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
    if(!cart.length) return;
    const printArea = document.getElementById('invoice-print-area');
    printArea.innerHTML = `
        <div style="text-align:center; padding:20px; font-family:sans-serif">
            <h2>RAJ CUSTOMER SERVICE POINT</h2>
            <p>Dhalpal, Tufanganj, Coochbehar | +91 8972766578</p>
            <hr>
            <table style="width:100%; text-align:left; margin:15px 0">
                <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price * i.qty}</td></tr>`).join('')}
            </table>
            <h3 style="text-align:right">Total: ${document.getElementById('bill-total').innerText}</h3>
        </div>`;
    window.print();
    cart = []; renderCart();
};
