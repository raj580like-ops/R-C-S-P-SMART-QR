import { db, collection, addDoc, doc, getDoc } from './firebase-config.js';

let cart = [];

export async function addToCartById(id) {
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
        alert("Product not found!");
    }
}

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
                <td>${item.qty}</td>
                <td>₹${item.price}</td>
                <td>₹${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('bill-total').innerText = total.toFixed(2);
}

document.getElementById('checkout-btn').onclick = async () => {
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    if (cart.length === 0) return alert("Cart is empty");

    const billData = {
        customer: name,
        phone: phone,
        items: cart,
        total: document.getElementById('bill-total').innerText,
        timestamp: new Date().toLocaleString()
    };

    // Save to Firestore
    await addDoc(collection(db, "invoices"), billData);
    
    // Prepare Print
    const printArea = document.getElementById('invoice-print-area');
    printArea.innerHTML = `
        <div style="text-align:center">
            <h1>R-C-S-P INVOICE</h1>
            <p>Bill #: ${Math.floor(Math.random()*100000)} | Date: ${billData.timestamp}</p>
        </div>
        <hr>
        <p>Customer: ${name} (${phone})</p>
        <table style="width:100%">
            ${cart.map(i => `<tr><td>${i.name} x ${i.qty}</td><td style="text-align:right">₹${i.price * i.qty}</td></tr>`).join('')}
        </table>
        <hr>
        <h2 style="text-align:right">Total: ₹${billData.total}</h2>
        <div style="margin-top:40px; text-align:center; font-size:12px;">
            <strong>Raj Customer Service Point</strong><br>
            +91 8972766578<br>
            Dhalpal, Tufanganj, Coochbehar
        </div>
    `;

    window.print();
    cart = [];
    renderCart();
};
