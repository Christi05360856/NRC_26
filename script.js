// ============================================================
// FIREBASE — loaded LAZILY (only when user submits)
// This script is OPTIONAL. The inline script in index.html
// handles all navigation. This file only adds Firebase submit.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAgmrQl_89WilbnudAMdrwmICos1Gc2VwE",
  authDomain: "nyc-2026-registration.firebaseapp.com",
  projectId: "nyc-2026-registration",
  storageBucket: "nyc-2026-registration.firebasestorage.app",
  messagingSenderId: "668244488462",
  appId: "1:668244488462:web:b2f2612cfb5159ef01275f"
};
const REGISTRATIONS_COLLECTION = "registrations";

let _db = null;
let _firestoreFns = null;
let _firebaseLoading = null;

function loadFirebase() {
  if (_firebaseLoading) return _firebaseLoading;
  _firebaseLoading = (async () => {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    const { getFirestore, collection, addDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
    );
    const app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
    _firestoreFns = { collection, addDoc, serverTimestamp };
    return _firestoreFns;
  })();
  return _firebaseLoading;
}

// Expose submit function so inline script can call it
window._nycSubmit = async function() {
  const form = document.getElementById("regForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusMsg = document.getElementById("statusMsg");
  const successOverlay = document.getElementById("successOverlay");

  if (!form) return;

  const data = Object.fromEntries(new FormData(form).entries());

  const payload = {
    fullName: data.fullName || "",
    gender: data.gender || "",
    dob: data.dob || "",
    phone: data.phone || "",
    church: data.church || "",
    branch: data.branch || "",
    state: data.state || "",
    occupation: data.occupation || "",
    attending: data.attending || "",
    feeCategory:
      data.fee === "Others"
        ? data.feeOtherAmount
          ? `Others: ₦${data.feeOtherAmount}`
          : "Others"
        : data.fee || "",
    volunteer: data.volunteer || "",
    volunteerUnit: data.volunteer === "Yes" ? data.volunteerUnit || "" : ""
  };

  try {
    const { collection, addDoc, serverTimestamp } = await loadFirebase();
    payload.submittedAt = serverTimestamp();
    await addDoc(collection(_db, REGISTRATIONS_COLLECTION), payload);
    if (successOverlay) successOverlay.classList.add("show");
  } catch (err) {
    console.error("Registration failed:", err);
    if (statusMsg) {
      statusMsg.textContent = "Couldn't submit — your connection may be too slow right now. Please try again.";
      statusMsg.style.color = "#C24444";
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Complete Registration 🔥";
    }
  }
};

console.log("[NYC2026] External script loaded — Firebase submit handler ready.");
