import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let currentUser = null;
let cart = [];
let allProducts = [];
let currentCategory = 'all';
let deliveryCharge = 0;
let searchTerm = '';

// Authentication Listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const authBtn = document.getElementById('auth-btn');
  const myOrdersBtn = document.getElementById('my-orders-btn');

  if (user) {
    authBtn.innerHTML = "🚪"; 
    myOrdersBtn.style.display = "flex";
    authBtn.onclick = () => { if (confirm("Are you sure logout?")) signOut(auth); };
  } else {
    authBtn.innerHTML = "👤"; 
    myOrdersBtn.style.display = "none";
    authBtn.onclick = () => document.getElementById('auth-modal').classList.add('active');
  }
});

// ✅ NEW FEATURE: AUTO BOOK FUNCTIONS
window.showAutoSection = () => {
    if(!currentUser) {
        alert("Please login to book an auto.");
        document.getElementById('auth-modal').classList.add('active');
        return;
    }
    const modal = document.getElementById('auto-modal');
    const listContainer = document.getElementById('driver-list');
    modal.classList.add('active');
    
    listContainer.innerHTML = "<p style='text-align:center;'>Searching for drivers...</p>";

    // Real-time listener for drivers collection
    onSnapshot(collection(db, "drivers"), (snap) => {
        listContainer.innerHTML = "";
        if(snap.empty) {
            listContainer.innerHTML = "<p style='text-align:center; color:#64748b; padding:20px;'>No drivers available right now.</p>";
            return;
        }
        snap.forEach(doc => {
            const d = doc.data();
            listContainer.innerHTML += `
                <div style="background:#f8fafc; padding:15px; border-radius:16px; margin-bottom:12px; border:1px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; font-size:16px;">${d.name}</h4>
                            <p style="margin:4px 0; color:var(--primary); font-weight:700;">₹${d.price} per KG/KM</p>
                        </div>
                        <span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold;">ACTIVE</span>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:12px;">
                        <a href="tel:${d.phone}" style="flex:1; background:#22c55e; color:white; text-decoration:none; text-align:center; padding:10px; border-radius:10px; font-size:14px; font-weight:600;">📞 Call Now</a>
                        <button onclick="bookAutoRide('${doc.id}', '${d.name}')" style="flex:1; background:var(--dark); color:white; border:none; padding:10px; border-radius:10px; font-weight:600; cursor:pointer;">🛺 Book Ride</button>
                    </div>
                </div>
            `;
        });
    });
};

window.bookAutoRide = async (driverId, driverName) => {
    try {
        await addDoc(collection(db, "rideBookings"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            driverId: driverId,
            driverName: driverName,
            status: "Pending",
            timestamp: serverTimestamp()
        });
        alert("Booking request sent to " + driverName + ". Driver will contact you shortly!");
    } catch (e) {
        alert("Booking error: " + e.message);
    }
};

// --- EXISTING APP LOGIC (SHOPPING SYSTEM) ---

// Load Shop Settings
onSnapshot(doc(db, "shopControl", "status"), (docSnap) => {
  if (docSnap.exists()) {
    const data = docSnap.data();
    deliveryCharge = data.deliveryCharge || 0;
    const overlay = document.getElementById('shop-closed-overlay');
    if (data.isClosed) overlay.style.display = 'flex';
    else overlay.style.display = 'none';
  }
});

// Load Categories
onSnapshot(collection(db, "categories"), (snap) => {
  const catList = document.getElementById('category-list');
  catList.innerHTML = `<div class="category-item ${currentCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all', this)">All</div>`;
  snap.forEach(doc => {
    const cat = doc.data().name;
    catList.innerHTML += `<div class="category-item ${currentCategory === cat ? 'active' : ''}" onclick="filterCategory('${cat}', this)">${cat}</div>`;
  });
});

// Load Products
onSnapshot(collection(db, "products"), (snap) => {
  allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderProducts();
});

function renderProducts() {
  const list = document.getElementById('product-list');
  list.innerHTML = "";
  
  const filtered = allProducts.filter(p => {
    const matchesCat = currentCategory === 'all' || p.category === currentCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  filtered.forEach(p => {
    const cartItem = cart.find(item => item.id === p.id);
    const qty = cartItem ? cartItem.qty : 0;

    list.innerHTML += `
      <div class="product-card">
        <img src="${p.imageUrl || 'https://via.placeholder.com/150'}" class="product-img">
        <div class="product-info">
          <h3 class="product-title">${p.name}</h3>
          <p class="product-price">₹${p.price} / ${p.unit}</p>
          ${qty > 0 ? `
            <div class="qty-control">
              <button onclick="updateQty('${p.id}', -1)">-</button>
              <span>${qty}</span>
              <button onclick="updateQty('${p.id}', 1)">+</button>
            </div>
          ` : `
            <button class="add-btn" onclick="updateQty('${p.id}', 1)">ADD</button>
          `}
        </div>
      </div>
    `;
  });
}

window.filterCategory = (cat, el) => {
  currentCategory = cat;
  document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  renderProducts();
};

document.getElementById('search-input').oninput = (e) => {
  searchTerm = e.target.value;
  renderProducts();
};

window.updateQty = (id, change) => {
  const index = cart.findIndex(item => item.id === id);
  if (index > -1) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) cart.splice(index, 1);
  } else if (change > 0) {
    const p = allProducts.find(item => item.id === id);
    cart.push({ ...p, qty: 1 });
  }
  updateCartUI();
  renderProducts();
};

function updateCartUI() {
  const bar = document.getElementById('cart-bar');
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (count > 0) {
    bar.classList.add('active');
    document.getElementById('cart-count').innerText = `${count} Items`;
    document.getElementById('cart-total').innerText = `₹${total + deliveryCharge}`;
  } else {
    bar.classList.remove('active');
  }
}

window.openCart = () => {
  const modal = document.getElementById('cart-modal');
  const list = document.getElementById('cart-items-list');
  modal.classList.add('active');
  list.innerHTML = "";

  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.price * item.qty;
    list.innerHTML += `
      <div class="cart-item">
        <div>
          <div style="font-weight:600;">${item.name}</div>
          <div style="font-size:12px; color:#64748b;">₹${item.price} x ${item.qty}</div>
        </div>
        <div style="font-weight:700;">₹${item.price * item.qty}</div>
      </div>
    `;
  });

  document.getElementById('modal-delivery-charge').innerText = `₹${deliveryCharge}`;
  document.getElementById('modal-total-amount').innerText = `₹${subtotal + deliveryCharge}`;
};

window.checkout = async () => {
  if (!currentUser) {
    alert("Please login to place order");
    document.getElementById('auth-modal').classList.add('active');
    return;
  }
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0) + deliveryCharge;
  try {
    await addDoc(collection(db, "orders"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      items: cart,
      totalAmount: total,
      status: 'Pending',
      createdAt: serverTimestamp()
    });
    alert("Order Placed Successfully!");
    cart = [];
    updateCartUI();
    document.getElementById('cart-modal').classList.remove('active');
    renderProducts();
  } catch (err) { alert(err.message); }
};

// Orders Modal Logic
async function loadUserOrders() {
    const list = document.getElementById('user-orders-list');
    list.innerHTML = "Loading...";
    const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const o = doc.data();
            list.innerHTML += `
                <div style="border:1px solid #eee; padding:10px; border-radius:10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <small>${o.createdAt?.toDate().toLocaleDateString()}</small>
                        <b style="color:var(--primary)">${o.status}</b>
                    </div>
                    <div style="margin-top:5px; font-weight:700;">Total: ₹${o.totalAmount}</div>
                </div>
            `;
        });
    });
}

document.getElementById('my-orders-btn').onclick = () => { document.getElementById('orders-modal').classList.add('active'); loadUserOrders(); };
document.getElementById('close-orders').onclick = () => document.getElementById('orders-modal').classList.remove('active');
document.getElementById('close-modal').onclick = () => document.getElementById('auth-modal').classList.remove('active');

// Auth Logic
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
    const submitBtn = document.getElementById('auth-submit');
    const modeBtn = document.getElementById('switch-mode');
    if (title.innerText === "Login") {
        title.innerText = "Register"; submitBtn.innerText = "Register"; modeBtn.innerText = "Already have an account? Login";
    } else {
        title.innerText = "Login"; submitBtn.innerText = "Login"; modeBtn.innerText = "New here? Register";
    }
};