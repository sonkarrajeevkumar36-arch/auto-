import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let currentUser = null;
let cart = [];
let allProducts = [];
let villages = [];
let currentCategory = 'all';
let globalDeliveryCharge = 0;
let searchTerm = '';

// 1. AUTH & UI SYNC (FIXED)
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authBtn = document.getElementById('auth-btn');
    const myOrdersBtn = document.getElementById('my-orders-btn');

    if (user) {
        authBtn.innerHTML = "🚪"; // Logout Icon
        myOrdersBtn.style.display = "flex";
        
        authBtn.onclick = () => { if(confirm("Logout?")) signOut(auth); };
        myOrdersBtn.onclick = () => { 
            document.getElementById('orders-modal').classList.add('active');
            loadUserOrders(); 
        };
    } else {
        authBtn.innerHTML = "👤"; // Login Icon
        myOrdersBtn.style.display = "none";
        authBtn.onclick = () => { document.getElementById('auth-modal').classList.add('active'); };
    }
});

// 2. DATA LISTENERS
onSnapshot(doc(db, "shopControl", "status"), (docSnap) => {
    if(docSnap.exists()) {
        const d = docSnap.data();
        globalDeliveryCharge = d.deliveryCharge || 0;
        document.getElementById('shop-closed-overlay').style.display = d.isClosed ? 'flex' : 'none';
    }
});

onSnapshot(collection(db, "villages"), (snap) => {
    villages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('cust-village');
    select.innerHTML = '<option value="">Select Village</option>' + 
        villages.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
});

onSnapshot(collection(db, "products"), (snap) => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
});

// 3. CORE FUNCTIONS
window.toggleCart = () => document.getElementById('cart-sidebar').classList.toggle('active');

window.addToCart = (id) => {
    const p = allProducts.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if(existing) existing.qty++;
    else cart.push({ ...p, qty: 1 });
    updateCartUI();
};

function renderProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = allProducts.map(p => `
        <div class="product-card">
            <img src="${p.imageUrl}" class="product-img">
            <div class="product-info">
                <h4>${p.name}</h4>
                <p>₹${p.price}</p>
                <button onclick="addToCart('${p.id}')" class="btn-primary">Add</button>
            </div>
        </div>`).join('');
}

async function loadUserOrders() {
    const list = document.getElementById('user-orders-list');
    list.innerHTML = "Loading...";
    const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = snap.docs.map(doc => {
        const o = doc.data();
        return `<div class="cart-item">Order: ₹${o.total} <br> Status: ${o.status}</div>`;
    }).join('') || "No orders found";
}

// 4. AUTH FORM HANDLING
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const isLogin = document.getElementById('modal-title').innerText === "Login";
    
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
        document.getElementById('auth-modal').classList.remove('active');
    } catch (err) { alert(err.message); }
};

document.getElementById('switch-mode').onclick = () => {
    const title = document.getElementById('modal-title');
    title.innerText = title.innerText === "Login" ? "Register" : "Login";
};

// Modal Close Buttons
document.getElementById('close-auth').onclick = () => document.getElementById('auth-modal').classList.remove('active');
document.getElementById('close-orders').onclick = () => document.getElementById('orders-modal').classList.remove('active');