import { db } from './firebase.js';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let allOrders = [];
let allProducts = [];

window.initAdmin = () => {
    // 1. Shop Settings Listener (Existing)
    onSnapshot(doc(db, "shopControl", "status"), (docSnap) => {
        if(docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('shop-toggle').checked = d.isClosed;
            document.getElementById('status-label').innerText = d.isClosed ? "CLOSED" : "OPEN";
            document.getElementById('delivery-charge-input').value = d.deliveryCharge || 0;
            document.getElementById('support-number-input').value = d.supportNumber || "8090315246";
        }
    });

    // 2. Orders Listener (Existing)
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrders();
    });

    // 3. Products Listener (Existing)
    onSnapshot(collection(db, "products"), (snap) => {
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminProducts();
    });

    // ✅ 4. Ride Bookings Listener (NEW)
    onSnapshot(query(collection(db, "rideBookings"), orderBy("timestamp", "desc")), (snap) => {
        const rideBody = document.getElementById('ride-list-body');
        rideBody.innerHTML = "";
        snap.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? r.timestamp.toDate().toLocaleString() : 'Just now';
            rideBody.innerHTML += `
                <tr>
                    <td>${r.userEmail}</td>
                    <td>${r.driverName}</td>
                    <td>${time}</td>
                    <td><span style="background:#fef08a; padding:4px 8px; border-radius:4px;">${r.status}</span></td>
                </tr>
            `;
        });
    });

    // ✅ 5. Drivers Listener (NEW)
    onSnapshot(collection(db, "drivers"), (snap) => {
        const driverContainer = document.getElementById('admin-driver-list');
        driverContainer.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data();
            driverContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px; margin-top:5px; border-radius:8px; border:1px solid #e2e8f0;">
                    <div>
                        <strong>${d.name}</strong> - ₹${d.price} <br>
                        <small>${d.phone}</small>
                    </div>
                    <button onclick="deleteDriver('${docSnap.id}')" class="btn-delete">🗑️</button>
                </div>
            `;
        });
    });
};

// ✅ NEW: Add Driver Function
window.addDriver = async () => {
    const name = document.getElementById('d-name').value;
    const phone = document.getElementById('d-phone').value;
    const price = document.getElementById('d-price').value;

    if(name && phone && price) {
        await addDoc(collection(db, "drivers"), {
            name, phone, price, createdAt: serverTimestamp()
        });
        alert("Driver Added!");
        document.getElementById('d-name').value = '';
        document.getElementById('d-phone').value = '';
        document.getElementById('d-price').value = '';
    } else {
        alert("Please fill all details");
    }
};

// ✅ NEW: Delete Driver Function
window.deleteDriver = async (id) => {
    if(confirm("Remove this driver?")) {
        await deleteDoc(doc(db, "drivers", id));
    }
};

// --- EXISTING FUNCTIONS ---

window.updateShopSettings = async () => {
    await setDoc(doc(db, "shopControl", "status"), {
        isClosed: document.getElementById('shop-toggle').checked,
        deliveryCharge: parseInt(document.getElementById('delivery-charge-input').value) || 0,
        supportNumber: document.getElementById('support-number-input').value
    }, { merge: true });
    alert("Settings Saved Successfully");
};

window.addProduct = async () => {
    const name = document.getElementById('p-name').value;
    const price = parseInt(document.getElementById('p-price').value);
    if(name && price) {
        await addDoc(collection(db, "products"), { 
            name, price, 
            unit: document.getElementById('p-unit').value, 
            imageUrl: document.getElementById('p-img').value, 
            category: document.getElementById('p-category').value, 
            status: 'Available', 
            createdAt: serverTimestamp() 
        });
        alert("Product Added");
    }
};

function renderAdminProducts() {
    const list = document.getElementById('admin-product-list');
    list.innerHTML = "";
    allProducts.forEach(p => {
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${p.name} (₹${p.price})</span>
                <button onclick="deleteProduct('${p.id}')" class="btn-delete">Delete</button>
            </div>
        `;
    });
}

window.deleteProduct = async (id) => { 
    if(confirm("Delete Product?")) await deleteDoc(doc(db, "products", id)); 
};

// Start Admin
window.initAdmin();