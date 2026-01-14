import { db, collection, addDoc } from './firebase-config.js';

const pName = document.getElementById('p-name');
const pBuy = document.getElementById('p-buy');
const pSell = document.getElementById('p-sell');
const pStock = document.getElementById('p-stock');
const calcPreview = document.getElementById('calc-preview');
const productForm = document.getElementById('product-form');

// Auto-calculate profit and margin
[pBuy, pSell].forEach(el => {
    el.addEventListener('input', () => {
        const b = parseFloat(pBuy.value) || 0;
        const s = parseFloat(pSell.value) || 0;
        const profit = s - b;
        const margin = b > 0 ? (profit / b * 100).toFixed(2) : 0;
        calcPreview.innerText = `Profit: ₹${profit.toFixed(2)} | Margin: ${margin}%`;
    });
});

productForm.onsubmit = async (e) => {
    e.preventDefault();
    const productData = {
        name: pName.value,
        buy: parseFloat(pBuy.value),
        sell: parseFloat(pSell.value),
        stock: parseInt(pStock.value),
        category: document.getElementById('p-cat').value,
        createdAt: new Date().toISOString()
    };

    try {
        const docRef = await addDoc(collection(db, "products"), productData);
        generateQRCode(docRef.id);
        alert("Product saved successfully!");
        productForm.reset();
    } catch (err) {
        alert("Error saving: " + err.message);
    }
};

function generateQRCode(id) {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: id,
        width: 180,
        height: 180
    });
    document.getElementById('qr-result-container').classList.remove('hidden');
    
    document.getElementById('download-qr').onclick = () => {
        const canvas = qrContainer.querySelector('canvas');
        const img = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `product-${id}.png`;
        link.href = img;
        link.click();
    };
}
