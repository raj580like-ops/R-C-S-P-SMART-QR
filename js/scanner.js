import { addToCartById } from './billing.js';
import { db, doc, getDoc } from './firebase-config.js';

let html5QrCode;

export function startScanner(targetElementId, onResult) {
    html5QrCode = new Html5Qrcode(targetElementId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        onResult(decodedText);
        // Optional: Stop after scan
        // html5QrCode.stop(); 
    });
}

// Global function for UI usage
window.showProductDetails = async (id) => {
    const docRef = doc(db, "products", id);
    const snap = await getDoc(docRef);
    if(snap.exists()){
        const data = snap.data();
        const resDiv = document.getElementById('scan-result');
        resDiv.classList.remove('hidden');
        resDiv.innerHTML = `
            <h4>${data.name}</h4>
            <p>Selling Price: ₹${data.sell}</p>
            <p>Stock: ${data.stock}</p>
            <button onclick="window.addToCartAndSwitch('${id}')" class="btn-primary">Add to Cart</button>
        `;
    }
};
