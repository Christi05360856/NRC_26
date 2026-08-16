// ============================================================
// FIREBASE — loaded LAZILY (only when the user actually submits)
// so a slow/blocked CDN fetch can never break page navigation.
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

// ============================================================
// STEP NAVIGATION
// ============================================================
const form = document.getElementById("regForm");
const steps = Array.from(document.querySelectorAll(".step"));
const progressFill = document.getElementById("progressFill");
let currentIndex = 0;

function showStep(index) {
  steps.forEach((s, i) => s.classList.toggle("active", i === index));
  progressFill.style.width = `${(index / (steps.length - 1)) * 100}%`;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  currentIndex = index;
}

function currentStepValid() {
  // HTML5 constraint validation automatically skips fields inside
  // display:none elements, so this only checks the visible step.
  return form.reportValidity();
}

// Attach click handlers to all [data-next] buttons
document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentStepValid()) return;
    if (currentIndex < steps.length - 1) showStep(currentIndex + 1);
  });
});

// Attach click handlers to all [data-back] buttons
document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentIndex > 0) showStep(currentIndex - 1);
  });
});

showStep(0);

// ============================================================
// FEE "OTHERS" TOGGLE
// ============================================================
const feeOtherBlock = document.getElementById("feeOtherBlock");
document.querySelectorAll('input[name="fee"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    feeOtherBlock.classList.toggle("show", radio.value === "Others");
  });
});

// ============================================================
// VOLUNTEER UNIT TOGGLE
// ============================================================
const volunteerBlock = document.getElementById("volunteerBlock");
document.querySelectorAll('input[name="volunteer"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    volunteerBlock.classList.toggle("show", radio.value === "Yes");
  });
});

// ============================================================
// COPY ACCOUNT NUMBER
// ============================================================
const copyBtn = document.getElementById("copyBtn");
const acctNum = document.getElementById("acctNum");
if (copyBtn && acctNum) {
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(acctNum.textContent.trim()).then(() => {
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = original), 1800);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = acctNum.textContent.trim();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = original), 1800);
    });
  });
}

// ============================================================
// SUBMIT → FIRESTORE
// ============================================================
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");
const successOverlay = document.getElementById("successOverlay");
const closeSuccess = document.getElementById("closeSuccess");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;

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

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  statusMsg.textContent = "";

  try {
    const { collection, addDoc, serverTimestamp } = await loadFirebase();
    payload.submittedAt = serverTimestamp();
    await addDoc(collection(_db, REGISTRATIONS_COLLECTION), payload);
    successOverlay.classList.add("show");
  } catch (err) {
    console.error("Registration failed:", err);
    statusMsg.textContent = "Couldn't submit — your connection may be too slow right now. Please try again.";
    statusMsg.style.color = "#C24444";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Registration 🔥";
  }
});

if (closeSuccess) {
  closeSuccess.addEventListener("click", () => {
    successOverlay.classList.remove("show");
    form.reset();
    feeOtherBlock.classList.remove("show");
    volunteerBlock.classList.remove("show");
    showStep(0);
  });
}
