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

// 1. AUTHENTICATION & UI SYNC
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authBtn = document.getElementById('auth-btn');
    const myOrdersBtn = document.getElementById('my-orders-btn');

    if (user) {
        authBtn.innerHTML = "Logout 🚪";
        authBtn.style.fontSize = "12px";
        authBtn.style.width = "auto";
        authBtn.style.padding = "0 10px";
        myOrdersBtn.style.display = "flex";
        
        authBtn.onclick = () => { if(confirm("Kya aap logout karna chahte hain?")) signOut(auth); };
        myOrdersBtn.onclick = () => { 
            document.getElementById('orders-modal').classList.add('active');
            loadUserOrders(); 
        };
    } else {
        authBtn.innerHTML = "👤";
        authBtn.style.width = "38px";
        myOrdersBtn.style.display = "none";
        authBtn.onclick = () => { document.getElementById('auth-modal').classList.add('active'); };
    }
});

// 2. REAL-TIME DATA LISTENERS
// Shop Status & Delivery
onSnapshot(doc(db, "shopControl", "status"), (docSnap) => {
    if(docSnap.exists()) {
        const d = docSnap.data();
        globalDeliveryCharge = d.deliveryCharge || 0;
        document.getElementById('shop-closed-overlay').style.display = d.isClosed ? 'flex' : 'none';
        updateCartUI();
    }
});

// Festival Banner
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

// Villages List
onSnapshot(collection(db, "villages"), (snap) => {
    villages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('cust-village');
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose Location --</option>' + 
        villages.map(v => `<option value="${v.id}" ${currentVal === v.id ? 'selected' : ''}>${v.name} (+₹${v.charge})</option>`).join('');
});

// Products
onSnapshot(collection(db, "products"), (snap) => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
});

// Categories
onSnapshot(collection(db, "categories"), (snap) => {
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const list = document.getElementById('category-list');
    list.innerHTML = `<button class="category-chip ${currentCategory==='all'?'active':''}" onclick="window.filterCat('all')">All Items</button>` +
        cats.map(c => `<button class="category-chip ${currentCategory===c.name?'active':''}" onclick="window.filterCat('${c.name}')">${c.name}</button>`).join('');
});

// 3. PRODUCT & SEARCH LOGIC
window.filterCat = (c) => { currentCategory = c; renderProducts(); };

function renderProducts() {
    const grid = document.getElementById('product-grid');
    const filtered = allProducts.filter(p => {
        const matchCat = currentCategory === 'all' || p.category === currentCategory;
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchSearch;
    });

    if(filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding:20px; color:#64748b;">Koi product nahi mila!</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="product-card">
            <img src="${p.imageUrl || 'https://via.placeholder.com/150'}" class="product-img" loading="lazy">
            <div class="product-info">
                <h4>${p.name}</h4>
                <p>₹${p.price} / ${p.unit}</p>
                ${p.status === 'Available' 
                    ? `<button onclick="addToCart('${p.id}')" class="btn-primary" style="width:100%; font-size:12px;">Add to Cart</button>`
                    : `<button class="btn-secondary" style="width:100%; font-size:12px;" disabled>Stock Out</button>`}
            </div>
        </div>`).join('');
}

document.getElementById('product-search').oninput = (e) => {
    searchTerm = e.target.value;
    renderProducts();
};

// 4. CART SYSTEM
window.addToCart = (id) => {
    const p = allProducts.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if(existing) existing.qty++;
    else cart.push({ ...p, qty: 1 });
    
    // Smooth Feedback
    const fab = document.getElementById('cart-fab-icon');
    fab.style.transform = "scale(1.2)";
    setTimeout(() => fab.style.transform = "scale(1)", 200);
    
    updateCartUI();
};

window.updateCartUI = () => {
    const container = document.getElementById('cart-items');
    let subtotal = 0;
    cart.forEach(item => subtotal += (item.price * item.qty));

    const selectedVillageId = document.getElementById('cust-village').value;
    const village = villages.find(v => v.id === selectedVillageId);
    const currentDeliveryCharge = village ? village.charge : (cart.length > 0 ? globalDeliveryCharge : 0);

    if(cart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px;"><p style="color:#94a3b8;">Aapka cart khali hai!</p></div>`;
    } else {
        container.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div style="flex:1">
                    <b style="font-size:14px;">${item.name}</b><br>
                    <small style="color:var(--primary); font-weight:700;">₹${item.price} x ${item.qty}</small>
                </div>
                <div class="qty-control">
                    <button onclick="changeQty('${item.id}', -1)">−</button>
                    <span style="font-weight:bold; min-width:20px; text-align:center;">${item.qty}</span>
                    <button onclick="changeQty('${item.id}', 1)">+</button>
                </div>
            </div>`).join('');
    }

    document.getElementById('cart-count').innerText = cart.reduce((a, b) => a + b.qty, 0);
    const total = subtotal + currentDeliveryCharge;
    document.getElementById('cart-total').innerText = `₹${total}`;
};

window.changeQty = (id, delta) => {
    const item = cart.find(x => x.id === id);
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(x => x.id !== id);
    updateCartUI();
};

window.toggleCart = () => document.getElementById('cart-sidebar').classList.toggle('active');

// 5. CHECKOUT & ORDERS
document.getElementById('checkout-btn').onclick = async () => {
    if(!currentUser) {
        alert("Pehle login karein!");
        document.getElementById('auth-modal').classList.add('active');
        return;
    }
    if(cart.length === 0) return alert("Cart khali hai!");
    
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const villageId = document.getElementById('cust-village').value;
    const address = document.getElementById('cust-address').value;

    if(!name || !phone || !villageId || !address) return alert("Kripya saari details bharein!");

    const village = villages.find(v => v.id === villageId);
    let subtotal = 0;
    cart.forEach(i => subtotal += (i.price * i.qty));
    const total = subtotal + village.charge;

    const orderData = {
        userId: currentUser.uid,
        customerName: name,
        customerPhone: phone,
        customerAddress: `${address}, Area: ${village.name}`,
        items: cart,
        total: total,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), orderData);
        const msg = `🚀 *Naya Order!* \n\n*Naam:* ${name}\n*Area:* ${village.name}\n*Address:* ${address}\n\n*Items:* \n${cart.map(i => '- ' + i.name + ' (' + i.qty + ')').join('\n')}\n\n*Grand Total:* ₹${total}`;
        window.open(`https://wa.me/918090315246?text=${encodeURIComponent(msg)}`);
        
        cart = [];
        updateCartUI();
        toggleCart();
        alert("Order safaltapurvak bhej diya gaya!");
    } catch(e) { alert("Error: " + e.message); }
};

// 6. USER ORDERS VIEW
async function loadUserOrders() {
    const list = document.getElementById('user-orders-list');
    list.innerHTML = "Order load ho rahe hain...";
    
    const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    
    if(snap.empty) {
        list.innerHTML = "<p style='text-align:center;'>Aapka koi purana order nahi hai.</p>";
        return;
    }

    list.innerHTML = snap.docs.map(doc => {
        const o = doc.data();
        return `
            <div style="border:1px solid #eee; padding:12px; border-radius:15px; margin-bottom:10px; font-size:13px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <b>Total: ₹${o.total}</b>
                    <span class="status-tag status-${o.status}">${o.status}</span>
                </div>
                <small style="color:#64748b;">${o.createdAt ? o.createdAt.toDate().toLocaleString() : 'Processing...'}</small>
            </div>`;
    }).join('');
}

// 7. AUTH FORMS & MODALS
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const title = document.getElementById('modal-title').innerText;
    
    try {
        if (title === "Login") await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
        document.getElementById('auth-modal').classList.remove('active');
    } catch (err) { alert(err.message); }
};

document.getElementById('switch-mode').onclick = () => {
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('auth-submit');
    const modeBtn = document.getElementById('switch-mode');
    if (title.innerText === "Login") {
        title.innerText = "Register"; submitBtn.innerText = "Create Account"; modeBtn.innerText = "Already have an account? Login";
    } else {
        title.innerText = "Login"; submitBtn.innerText = "Login"; modeBtn.innerText = "New here? Create Account";
    }
};

document.getElementById('close-auth').onclick = () => document.getElementById('auth-modal').classList.remove('active');
document.getElementById('close-orders').onclick = () => document.getElementById('orders-modal').classList.remove('active');