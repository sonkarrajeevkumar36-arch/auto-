import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, onSnapshot, query, where, orderBy, getDocs, doc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let currentUser = null;

// 1. SELECTING ELEMENTS
const authBtn = document.getElementById('auth-btn');
const myOrdersBtn = document.getElementById('my-orders-btn');
const contactBtn = document.getElementById('contact-btn');
const authModal = document.getElementById('auth-modal');
const ordersModal = document.getElementById('orders-modal');

// 2. CONTACT LOGIC
contactBtn.addEventListener('click', () => {
    window.open('https://wa.me/918090315246', '_blank');
});

// 3. AUTHENTICATION & UI SYNC
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authBtn.innerHTML = "🚪"; // Logout Icon
        myOrdersBtn.style.display = "flex";
    } else {
        authBtn.innerHTML = "👤"; // Login Icon
        myOrdersBtn.style.display = "none";
    }
});

// 4. BUTTON CLICK LOGIC (GLOBAL)
authBtn.addEventListener('click', () => {
    if (currentUser) {
        if (confirm("Kya aap Logout karna chahte hain?")) {
            signOut(auth);
        }
    } else {
        authModal.classList.add('active');
    }
});

myOrdersBtn.addEventListener('click', () => {
    ordersModal.classList.add('active');
    loadUserOrders();
});

// 5. MODAL CLOSING LOGIC
document.getElementById('close-auth').onclick = () => authModal.classList.remove('active');
document.getElementById('close-orders').onclick = () => ordersModal.classList.remove('active');

// 6. LOGIN/REGISTER LOGIC
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const isLogin = document.getElementById('modal-title').innerText === "Login";
    
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
        authModal.classList.remove('active');
    } catch (err) {
        alert("Error: " + err.message);
    }
};

document.getElementById('switch-mode').onclick = () => {
    const title = document.getElementById('modal-title');
    title.innerText = title.innerText === "Login" ? "Register" : "Login";
};

// 7. LOAD ORDERS FUNCTION
async function loadUserOrders() {
    const list = document.getElementById('user-orders-list');
    list.innerHTML = "<p>Loading your orders...</p>";
    
    try {
        const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            list.innerHTML = "<p>Koi order nahi mila.</p>";
            return;
        }

        list.innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            return `<div style="border-bottom:1px solid #eee; padding:10px;">
                        <b>Total: ₹${o.total}</b> - <small>${o.status}</small>
                    </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = "<p>Orders load karne mein error aaya. (Check Firestore Index)</p>";
        console.error(e);
    }
}