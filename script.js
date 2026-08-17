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

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "app/timeout" })), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let _db = null;
let _auth = null;
let _firestoreFns = null;
let _firebaseLoading = null;

function loadFirebase() {
  if (_firebaseLoading) return _firebaseLoading;
  _firebaseLoading = (async () => {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    const { getFirestore, collection, doc, setDoc, serverTimestamp, query, where, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
    );
    const { getAuth, signInAnonymously } = await import(
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
    );
    const app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
    _auth = getAuth(app);
    // Anonymous sign-in — invisible to the registrant, but satisfies the
    // security rule that requires request.auth != null for the duplicate check.
    if (!_auth.currentUser) {
      await signInAnonymously(_auth);
    }
    _firestoreFns = { collection, doc, setDoc, serverTimestamp, query, where, getDocs };
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

  const fullName = (data.fullName || "").trim();
  const phone = (data.phone || "").trim();
  const nameNorm = fullName.toLowerCase().replace(/\s+/g, " ");
  const phoneNorm = phone.replace(/[^\d]/g, "");

  const feeCategory =
    data.fee === "Others"
      ? data.feeOtherAmount
        ? `Others: ₦${data.feeOtherAmount}`
        : "Others"
      : data.fee || "";

  const payload = {
    fullName: fullName,
    gender: data.gender || "",
    dob: data.dob || "",
    phone: phone,
    phoneNorm: phoneNorm,
    nameNorm: nameNorm,
    church: data.church || "",
    branch: data.branch || "",
    state: data.state || "",
    occupation: data.occupation || "",
    attending: data.attending || "",
    feeCategory: feeCategory,
    volunteer: data.volunteer || "",
    volunteerUnit: data.volunteer === "Yes" ? data.volunteerUnit || "" : ""
  };

  try {
    const { collection, doc, setDoc, serverTimestamp, query, where, getDocs } = await withTimeout(loadFirebase(), 20000);

    // Block only exact same person (same phone + same name) registering twice.
    // A different name on the same phone (e.g. registering a friend) is allowed.
    const dupQuery = query(
      collection(_db, REGISTRATIONS_COLLECTION),
      where("phoneNorm", "==", phoneNorm),
      where("nameNorm", "==", nameNorm)
    );
    const dupSnap = await withTimeout(getDocs(dupQuery), 20000);
    if (!dupSnap.empty) {
      if (statusMsg) {
        statusMsg.textContent = "It looks like this name and number are already registered. Registering a friend? Use their name.";
        statusMsg.style.color = "#C24444";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Complete Registration 🔥";
      }
      return;
    }

    const docRef = doc(collection(_db, REGISTRATIONS_COLLECTION));
    const regNumber = "NYC26-" + docRef.id.slice(0, 6).toUpperCase();
    payload.regNumber = regNumber;
    payload.checkedIn = false;
    payload.checkedInAt = null;
    payload.checkedInBy = null;
    payload.submittedAt = serverTimestamp();
    await withTimeout(setDoc(docRef, payload), 20000);

    const cardRegNumber = document.getElementById("cardRegNumber");
    const cardName = document.getElementById("cardName");
    const cardCategory = document.getElementById("cardCategory");
    const cardQr = document.getElementById("cardQr");
    if (cardRegNumber) cardRegNumber.textContent = regNumber;
    if (cardName) cardName.textContent = fullName;
    if (cardCategory) cardCategory.textContent = feeCategory;
    if (cardQr) {
      const qrData = encodeURIComponent(regNumber);
      cardQr.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + qrData;
    }

    if (successOverlay) successOverlay.classList.add("show");
  } catch (err) {
    console.error("Registration failed:", err);
    let msg;
    if (err && err.code === "app/timeout") {
      msg = "This is taking longer than usual — your connection may be weak. Your details are still here, just tap Complete Registration again.";
    } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
      msg = "You appear to be offline. Your details are still here — reconnect and tap Complete Registration again.";
    } else if (err && err.code === "permission-denied") {
      msg = "Couldn't submit right now — please try again in a moment. (ref: permission-denied)";
    } else {
      msg = "Couldn't submit — please try again." + (err && err.code ? " (ref: " + err.code + ")" : "");
    }
    if (statusMsg) {
      statusMsg.textContent = msg;
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

// Start fetching Firebase in the background the moment this script runs,
// instead of waiting for submit. On a weak connection, the worst possible
// time to first load the SDK is the moment someone hits "Complete
// Registration" — this way it's usually already cached by then, since
// filling the form takes ~2 minutes.
loadFirebase().catch(function() { /* real errors resurface at submit time */ });
