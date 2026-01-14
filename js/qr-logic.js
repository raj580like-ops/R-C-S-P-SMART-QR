import { db, collection, addDoc } from './firebase-config.js';

// Get UI elements
const productForm = document.getElementById('product-form');
const pName = document.getElementById('p-name');
const pBuy = document.getElementById('p-buy');
const pSell = document.getElementById('p-sell');
const pStock = document.getElementById('p-stock');
const pCat = document.getElementById('p-cat');
const calcPreview = document.getElementById('calc-preview');
const qrResultContainer = document.getElementById('qr-result-container');
const qrcodeDiv = document.getElementById('qrcode');

// 1. AUTO-CALCULATE PROFIT/MARGIN
[pBuy, pSell].forEach(input => {
    input.addEventListener('input', () => {
        const buy = parseFloat(pBuy.value) || 0;
        const sell = parseFloat(pSell.value) || 0;
        const profit = sell - buy;
        const margin = buy > 0 ? ((profit / buy) * 100).toFixed(2) : 0;
        calcPreview.innerText = `Profit: ₹${profit.toFixed(2)} | Margin: ${margin}%`;
    });
});

// 2. HANDLE FORM SUBMISSION
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        // STOP THE PAGE FROM REFRESHING/REDIRECTING
        e.preventDefault();
        console.log("Saving product...");

        // Visual Feedback
        const submitBtn = productForm.querySelector('button[type="submit"]');
        submitBtn.innerText = "Saving to Database...";
        submitBtn.disabled = true;

        const productData = {
            name: pName.value.trim(),
            buy: parseFloat(pBuy.value),
            sell: parseFloat(pSell.value),
            stock: parseInt(pStock.value),
            category: pCat.value.trim() || "General",
            timestamp: new Date().toISOString()
        };

        try {
            // A. Save to Firebase Firestore
            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("Product saved with ID:", docRef.id);

            // B. Generate QR Code
            generateProductQR(docRef.id);

            // C. Success Message
            alert("✅ Product Saved Successfully!");
            
            // D. Clean up form
            productForm.reset();
            calcPreview.innerText = "Profit: ₹0.00 | Margin: 0%";
            
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("❌ Failed to save: " + error.message);
        } finally {
            submitBtn.innerText = "Save & Generate QR";
            submitBtn.disabled = false;
        }
    });
}

// 3. QR GENERATION FUNCTION
function generateProductQR(productId) {
    // Clear previous QR if any
    qrcodeDiv.innerHTML = "";
    
    // Generate new QR using the library loaded in index.html
    try {
        new QRCode(qrcodeDiv, {
            text: productId, // We store the ID, not the price
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Show the result container
        qrResultContainer.classList.remove('hidden');

        // Setup Download Button
        document.getElementById('download-qr').onclick = () => {
            const canvas = qrcodeDiv.querySelector('canvas');
            if (canvas) {
                const img = canvas.toDataURL("image/png");
                const link = document.createElement('a');
                link.download = `QR_${productData.name}.png`;
                link.href = img;
                link.click();
            } else {
                alert("QR not ready for download yet.");
            }
        };
    } catch (err) {
        console.error("QR Generation Error:", err);
    }
}
