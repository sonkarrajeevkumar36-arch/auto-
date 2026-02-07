import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let currentUser = null;
let cart = [];
let allProducts = [];
let currentCategory = 'all';
let globalDeliveryCharge = 0;
let villages = [];
let searchTerm = '';

// Authentication & Initial Listeners
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authBtn = document.getElementById('auth-btn');
    const myOrdersBtn = document.getElementById('my-orders-btn');
    if (user) {
        authBtn.innerHTML = "🚪";
        myOrdersBtn.style.display = "flex";
    } else {
        authBtn.innerHTML = "👤";
        myOrdersBtn.style.display = "none";
    }
});

// Real-time Listeners
onSnapshot(doc(db, "shopControl", "status"), (docSnap) => {
    if(docSnap.exists()) {
        const d = docSnap.data();
        globalDeliveryCharge = d.deliveryCharge || 0;
        document.getElementById('shop-closed-overlay').style.display = d.isClosed ? 'flex' : 'none';
        updateCartUI();
    }
});

// NEW: Banner Listener
onSnapshot(doc(db, "shopControl", "banner"), (docSnap) => {
    const bannerDiv = document.getElementById('banner-container');
    const bannerImg = document.getElementById('promo-banner');
    if (docSnap.exists()) {
        const b = docSnap.data();
        if (b.active && b.url) {
            bannerImg.src = b.url;
            bannerDiv.style.display = 'block';
        } else {
            bannerDiv.style.display = 'none';
        }
    }
});

// NEW: Villages Listener
onSnapshot(collection(db, "villages"), (snap) => {
    villages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('cust-village');
    select.innerHTML = '<option value="">Choose Village</option>' + 
        villages.map(v => `<option value="${v.id}">${v.name} (+₹${v.charge})</option>`).join('');
});

onSnapshot(collection(db, "products"), (snap) => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
});

onSnapshot(collection(db, "categories"), (snap) => {
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('category-list').innerHTML = `<button class="category-chip ${currentCategory==='all'?'active':''}" onclick="filterCat('all')">All</button>` +
        cats.map(c => `<button class="category-chip ${currentCategory===c.name?'active':''}" onclick="filterCat('${c.name}')">${c.name}</button>`).join('');
});

// Core Functions
window.filterCat = (c) => { currentCategory = c; renderProducts(); };

function renderProducts() {
    const grid = document.getElementById('product-grid');
    const filtered = allProducts.filter(p => {
        const matchCat = currentCategory === 'all' || p.category === currentCategory;
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchSearch;
    });

    grid.innerHTML = filtered.map(p => `
        <div class="product-card">
            <img src="${p.imageUrl || 'https://via.placeholder.com/150'}" class="product-img">
            <div class="product-info">
                <h4 style="margin:0 0 5px 0">${p.name}</h4>
                <p style="color:var(--primary); font-weight:800; margin:0 0 10px 0">₹${p.price} / ${p.unit}</p>
                ${p.status === 'Available' 
                    ? `<button onclick="addToCart('${p.id}')" class="btn-primary" style="width:100%; font-size:12px;">Add to Cart</button>`
                    : `<button class="btn-secondary" style="width:100%; font-size:12px;" disabled>Out of Stock</button>`}
            </div>
        </div>`).join('');
}

window.addToCart = (id) => {
    const p = allProducts.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if(existing) existing.qty++;
    else cart.push({ ...p, qty: 1 });
    updateCartUI();
};

window.updateCartUI = () => {
    const container = document.getElementById('cart-items');
    let subtotal = 0;
    cart.forEach(item => subtotal += (item.price * item.qty));

    // Calculate Dynamic Delivery Charge
    const selectedVillageId = document.getElementById('cust-village').value;
    const village = villages.find(v => v.id === selectedVillageId);
    const currentDeliveryCharge = village ? village.charge : globalDeliveryCharge;

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div><b>${item.name}</b><br><small>₹${item.price} x ${item.qty}</small></div>
            <div class="qty-control">
                <button onclick="changeQty('${item.id}', -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="changeQty('${item.id}', 1)">+</button>
            </div>
        </div>`).join('');

    document.getElementById('cart-count').innerText = cart.reduce((a, b) => a + b.qty, 0);
    const total = subtotal > 0 ? (subtotal + currentDeliveryCharge) : 0;
    document.getElementById('cart-total').innerText = `₹${total}`;
};

window.changeQty = (id, delta) => {
    const item = cart.find(x => x.id === id);
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(x => x.id !== id);
    updateCartUI();
};

window.toggleCart = () => document.getElementById('cart-sidebar').classList.toggle('active');

document.getElementById('product-search').oninput = (e) => { searchTerm = e.target.value; renderProducts(); };

document.getElementById('checkout-btn').onclick = async () => {
    if(!currentUser) return alert("Please login first");
    if(cart.length === 0) return alert("Cart is empty");
    
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const villageId = document.getElementById('cust-village').value;
    const address = document.getElementById('cust-address').value;

    if(!name || !phone || !villageId || !address) return alert("Please fill all details");

    const village = villages.find(v => v.id === villageId);
    let subtotal = 0;
    cart.forEach(i => subtotal += (i.price * i.qty));
    const total = subtotal + village.charge;

    const orderData = {
        userId: currentUser.uid,
        customerName: name,
        customerPhone: phone,
        customerAddress: `${address}, Village: ${village.name}`,
        items: cart,
        total: total,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), orderData);
        // WhatsApp Message
        const msg = `New Order! \nName: ${name}\nVillage: ${village.name}\nTotal: ₹${total}\nItems: ${cart.map(i => i.name + ' x' + i.qty).join(', ')}`;
        window.open(`https://wa.me/918090315246?text=${encodeURIComponent(msg)}`);
        cart = [];
        updateCartUI();
        toggleCart();
        alert("Order Placed!");
    } catch(e) { alert("Error: " + e.message); }
};