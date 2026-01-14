import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIG (REPLACE WITH YOUR KEYS)
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
// 2. GLOBAL UI CONTROLS
// ==========================================
let activeScanner = null;
let cart = [];

// Attach to window so HTML onclick works
window.showModule = async function(moduleId) {
    console.log("Navigating to:", moduleId);
    
    // Stop any running scanner
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

// Auth State
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.style.display = 'none';

    if (user) {
        document.getElementById('main-header').classList.remove('hidden');
        window.showModule('dashboard');
    } else {
        document.getElementById('main-header').classList.add('hidden');
        window.showModule('login-screen');
    }
});

// Login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pw').value);
    } catch (err) { alert("Login Error: " + err.message); }
});

// Logout
document.getElementById('logout-btn').onclick = () => signOut(auth);

// ==========================================
// 3. QR GENERATOR LOGIC
// ==========================================
const productForm = document.getElementById('product-form');
if (productForm) {
    const buyIn = document.getElementById('p-buy');
    const sellIn = document.getElementById('p-sell');
    
    [buyIn, sellIn].forEach(input => input.addEventListener('input', () => {
        const b = parseFloat(buyIn.value) || 0;
        const s = parseFloat(sellIn.value) || 0;
        const p = s - b;
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
            alert("✅ Product Saved!");
            productForm.reset();
        } catch (err) { alert("Error: " + err.message); }
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
// 4. SCANNER: LOOKUP MODULE (FIXED)
// ==========================================
window.startLookupScan = async function() {
    console.log("Starting Lookup Scanner...");
    if (activeScanner) { await activeScanner.stop(); }
    
    activeScanner = new Html5Qrcode("reader-lookup");
    document.getElementById('lookup-result').classList.add('hidden');
    
    activeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        async (id) => {
            console.log("Scanned ID:", id);
            await activeScanner.stop();
            activeScanner = null;
            
            try {
                const snap = await getDoc(doc(db, "products", id));
                if (snap.exists()) {
                    const p = snap.data();
                    const res = document.getElementById('lookup-result');
                    res.innerHTML = `
                        <h3 style="color:var(--primary)">${p.name}</h3>
                        <p><b>Price:</b> ₹${p.sell}</p>
                        <p><b>Stock:</b> ${p.stock} pcs</p>
                        <p><b>Category:</b> ${p.category}</p>
                    `;
                    res.classList.remove('hidden');
                } else {
                    alert("Product not found in database.");
                }
            } catch (e) { alert("Error fetching product details."); }
        }
    ).catch(e => {
        console.error(e);
        alert("Camera Permission Denied or Error.");
    });
};

// ==========================================
// 5. SCANNER: BILLING MODULE (FIXED)
// ==========================================
window.startBillingScan = async function() {
    console.log("Starting Billing Scanner...");
    if (activeScanner) { await activeScanner.stop(); }
    
    activeScanner = new Html5Qrcode("reader-billing");
    activeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        async (id) => {
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
                    renderCart();
                    // Optional: play a small beep sound here
                }
            } catch (e) { console.error("Billing scan error", e); }
        }
    ).catch(e => alert("Camera Error: " + e));
};

function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        tbody.innerHTML += `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #eee">${item.name}</td>
                <td style="border-bottom:1px solid #eee">${item.qty}</td>
                <td style="border-bottom:1px solid #eee">₹${item.price}</td>
                <td style="border-bottom:1px solid #eee; font-weight:bold">₹${(item.price * item.qty).toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('bill-total').innerText = `₹${total.toFixed(2)}`;
}

document.getElementById('checkout-btn').onclick = () => {
    if (cart.length === 0) return alert("Cart is empty");
    const name = document.getElementById('cust-name').value || "Guest";
    const phone = document.getElementById('cust-phone').value || "N/A";
    
    const printArea = document.getElementById('invoice-print-area');
    printArea.innerHTML = `
        <div style="text-align:center; font-family:sans-serif; padding:20px; border:1px solid #000">
            <h2 style="margin:0">RAJ CUSTOMER SERVICE POINT</h2>
            <p style="margin:5px">Dhalpal, Tufanganj, Coochbehar<br>+91 8972766578</p>
            <hr>
            <div style="text-align:left; font-size:14px">
                <p><b>Customer:</b> ${name} | <b>Mob:</b> ${phone}</p>
                <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; margin:15px 0; text-align:left">
                <tr style="border-bottom:1px solid #000"><th>Item</th><th>Qty</th><th>Total</th></tr>
                ${cart.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
            </table>
            <hr>
            <h3 style="text-align:right">Total: ${document.getElementById('bill-total').innerText}</h3>
            <p style="margin-top:20px; font-size:12px">Thank you for your business!</p>
        </div>
    `;
    window.print();
    cart = [];
    renderCart();
};
