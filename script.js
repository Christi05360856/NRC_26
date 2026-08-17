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
    const { getFirestore, collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit } = await import(
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
    );
    const { getAuth, signInAnonymously } = await import(
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
    );
    const app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
    _auth = getAuth(app);
    if (!_auth.currentUser) {
      await signInAnonymously(_auth);
    }
    _firestoreFns = { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit };
    return _firestoreFns;
  })();
  return _firebaseLoading;
}

function formatRegNumberForCard(regNumber) {
  return (regNumber || "").replace("-", "  ·  ");
}

function toDataUrl(url) {
  return fetch(url, { mode: "cors" })
    .then(function(res) {
      if (!res.ok) throw new Error("qr fetch failed: " + res.status);
      return res.blob();
    })
    .then(function(blob) {
      return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
}

// Fills in and shows the reg card overlay. Used both right after a
// successful submission and when an existing registrant looks their
// card up via "Find your card".
function renderCard(regNumber, fullName, feeCategory) {
  const cardRegNumber = document.getElementById("cardRegNumber");
  const cardName = document.getElementById("cardName");
  const cardCategory = document.getElementById("cardCategory");
  const cardQr = document.getElementById("cardQr");
  const successOverlay = document.getElementById("successOverlay");

  // Populate live card
  if (cardRegNumber) cardRegNumber.textContent = formatRegNumberForCard(regNumber);
  if (cardName) cardName.textContent = fullName;
  if (cardCategory) cardCategory.textContent = feeCategory;

  // Populate hidden export card
  const cardRegNumberExport = document.getElementById("cardRegNumberExport");
  const cardNameExport = document.getElementById("cardNameExport");
  const cardCategoryExport = document.getElementById("cardCategoryExport");
  const cardQrExport = document.getElementById("cardQrExport");

  if (cardRegNumberExport) cardRegNumberExport.textContent = formatRegNumberForCard(regNumber);
  if (cardNameExport) cardNameExport.textContent = fullName;
  if (cardCategoryExport) cardCategoryExport.textContent = feeCategory;

  if (cardQr) {
    const qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=" + encodeURIComponent(regNumber);
    toDataUrl(qrApiUrl)
      .then(function(dataUrl) {
        cardQr.src = dataUrl;
        if (cardQrExport) cardQrExport.src = dataUrl;
      })
      .catch(function(err) {
        console.warn("QR data-URL fetch failed, falling back to direct src:", err);
        cardQr.src = qrApiUrl;
        if (cardQrExport) cardQrExport.src = qrApiUrl;
      });
  }

  if (successOverlay) successOverlay.classList.add("show");
}

function normalizeRegNumberForSearch(raw) {
  let v = (raw || "").trim().toUpperCase();
  if (v && !v.startsWith("NYC26-")) v = "NYC26-" + v;
  return v;
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
    const { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit } = await withTimeout(loadFirebase(), 20000);

    const dupQuery = query(
      collection(_db, REGISTRATIONS_COLLECTION),
      where("phoneNorm", "==", phoneNorm),
      where("nameNorm", "==", nameNorm),
      limit(1)
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

    window._nycCardOverlayReason = "submit";
    renderCard(regNumber, fullName, feeCategory);
    if (typeof window._nycClearDraft === "function") window._nycClearDraft();
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

window._nycFindCard = async function(mode, values) {
  const errEl = document.getElementById("findCardError");
  const btn = document.getElementById("findCardBtn");
  if (errEl) { errEl.textContent = ""; errEl.classList.remove("show"); }

  let regNumber = "", nameNorm = "", phoneNorm = "";
  if (mode === "regnumber") {
    regNumber = normalizeRegNumberForSearch(values.regNumber);
    if (!regNumber || regNumber === "NYC26-") {
      if (errEl) { errEl.textContent = "Enter your registration number."; errEl.classList.add("show"); }
      return;
    }
  } else {
    const fullName = (values.fullName || "").trim();
    const phone = (values.phone || "").trim();
    nameNorm = fullName.toLowerCase().replace(/\s+/g, " ");
    phoneNorm = phone.replace(/[^\d]/g, "");
    if (!nameNorm || !phoneNorm) {
      if (errEl) { errEl.textContent = "Enter both your full name and phone number."; errEl.classList.add("show"); }
      return;
    }
  }

  if (btn) { btn.disabled = true; btn.textContent = "Searching…"; }
  try {
    const { collection, query, where, getDocs, limit } = await withTimeout(loadFirebase(), 20000);
    const q = mode === "regnumber"
      ? query(collection(_db, REGISTRATIONS_COLLECTION), where("regNumber", "==", regNumber), limit(1))
      : query(
          collection(_db, REGISTRATIONS_COLLECTION),
          where("phoneNorm", "==", phoneNorm),
          where("nameNorm", "==", nameNorm),
          limit(1)
        );
    const snap = await withTimeout(getDocs(q), 20000);
    if (snap.empty) {
      if (errEl) {
        errEl.textContent = "No registration found with those details. Double-check them, or scroll down to register.";
        errEl.classList.add("show");
      }
      return;
    }
    const d = snap.docs[0].data();
    window._nycCardOverlayReason = "find";
    renderCard(d.regNumber, d.fullName, d.feeCategory);
  } catch (err) {
    console.error("Find card failed:", err);
    let msg;
    if (err && err.code === "app/timeout") {
      msg = "This is taking longer than usual — check your connection and try again.";
    } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
      msg = "You appear to be offline. Reconnect and try again.";
    } else {
      msg = "Search failed — please try again." + (err && err.code ? " (ref: " + err.code + ")" : "");
    }
    if (errEl) { errEl.textContent = msg; errEl.classList.add("show"); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Find my card"; }
  }
};

console.log("[NYC2026] External script loaded — Firebase submit handler ready.");

loadFirebase().catch(function() { /* real errors resurface at submit time */ });
