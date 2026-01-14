import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIG (ADD YOUR KEYS HERE)
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
// 2. CORE NAVIGATION
// ==========================================
let activeScanner = null;

window.showModule = async function(moduleId) {
    // If a camera is running, stop it before switching
    if (activeScanner) {
        try { await activeScanner.stop(); } catch(e) {}
        activeScanner = null;
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(moduleId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
};

// Login/Logout persistence
onAuthStateChanged(auth, (user) => {
    document.getElementById('initial-loader').style.display = 'none';
    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        showModule('dashboard');
    } else {
        document.getElementById('main-header').classList.add('hidden');
        showModule('login-screen');
    }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pw').value);
    } catch (err) { alert("Error: " + err.message); }
});

document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 3. QR GENERATOR LOGIC
// ==========================================
const productForm = document.getElementById('product-form');
if (productForm) {
    // Auto-calc profit
    const buyIn = document.getElementById('p-buy');
    const sellIn = document.getElementById('p-sell');
    [buyIn, sellIn].forEach(input => input.addEventListener('input', () => {
        const p = (parseFloat(sellIn.value) || 0) - (parseFloat(buyIn.value) || 0);
        document.getElementById('calc-preview').innerText = `Profit: ₹${p.toFixed(2)}`;
    }));

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = productForm.querySelector('button');
        btn.innerText = "Saving..."; btn.disabled = true;

        const data = {
            name: document.getElementById('p-name').value,
            buy: parseFloat(buyIn.value),
            sell: parseFloat(sellIn.value),
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
            alert("Success!");
            productForm.reset();
        } catch (err) { alert(err.message); }
        btn.innerText = "Save & Generate QR"; btn.disabled = false;
    });
}

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
// 4. MODULE: SCANNER (LOOKUP)
// ==========================================
window.startLookupScan = async () => {
    activeScanner = new Html5Qrcode("reader-lookup");
    document.getElementById('lookup-result').classList.add('hidden');
    
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        async (id) => {
            await activeScanner.stop();
            const snap = await getDoc(doc(db, "products", id));
            if (snap.exists()) {
                const p = snap.data();
                const res = document.getElementById('lookup-result');
                res.innerHTML = `
                    <h3>${p.name}</h3>
                    <p><b>Selling Price:</b> ₹${p.sell}</p>
                    <p><b>Stock:</b> ${p.stock} units</p>
                    <p><b>Category:</b> ${p.category}</p>
                `;
                res.classList.remove('hidden');
            } else { alert("Product not found."); }
        }
    ).catch(e => alert("Camera Error: " + e));
};

// ==========================================
// 5. MODULE: BILLING SYSTEM
// ==========================================
let cart = [];

window.startBillingScan = async () => {
    activeScanner = new Html5Qrcode("reader-billing");
    activeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        async (id) => {
            // We don't stop the scanner here so user can scan multiple items
            const snap = await getDoc(doc(db, "products", id));
            if (snap.exists()) {
                const p = snap.data();
                const existing = cart.find(i => i.id === id);
                if (existing) existing.qty++;
                else cart.push({ id, name: p.name, price: p.sell, qty: 1 });
                renderCart();
            }
        }
    ).catch(e => alert("Camera Error: " + e));
};

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
        total += (item.price * item.qty);
        tbody.innerHTML += `<tr><td style="padding:8px">${item.name}</td><td>${item.qty}</td><td>₹${item.price}</td><td>₹${(item.price * item.qty).toFixed(2)}</td></tr>`;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

document.getElementById('checkout-btn').onclick = () => {
    if (cart.length === 0) return alert("Cart is empty");
    const name = document.getElementById('cust-name').value || "Guest";
    const phone = document.getElementById('cust-phone').value || "N/A";
    
    document.getElementById('invoice-print-area').innerHTML = `
        <div style="text-align:center; font-family:sans-serif; padding:20px">
            <h2>RAJ CUSTOMER SERVICE POINT</h2>
            <p>Dhalpal, Tufanganj, Coochbehar | +91 8972766578</p>
            <hr>
            <div style="text-align:left">
                <p><b>Customer:</b> ${name} | <b>Mob:</b> ${phone}</p>
                <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; margin:15px 0">
                <tr style="border-bottom:1px solid #000"><th>Item</th><th>Qty</th><th>Total</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price * i.qty}</td></tr>`).join('')}
            </table>
            <h3 style="text-align:right">Total: ${document.getElementById('bill-total').innerText}</h3>
            <p style="margin-top:30px">--- Thank You ---</p>
        </div>
    `;
    window.print();
    cart = []; renderCart();
};
