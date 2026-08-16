// ============================================================
// FIREBASE CONFIG — nyc-2026-registration project
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgmrQl_89WilbnudAMdrwmICos1Gc2VwE",
  authDomain: "nyc-2026-registration.firebaseapp.com",
  projectId: "nyc-2026-registration",
  storageBucket: "nyc-2026-registration.firebasestorage.app",
  messagingSenderId: "668244488462",
  appId: "1:668244488462:web:b2f2612cfb5159ef01275f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const REGISTRATIONS_COLLECTION = "registrations";

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

document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentStepValid()) return;
    if (currentIndex < steps.length - 1) showStep(currentIndex + 1);
  });
});

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
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(acctNum.textContent.trim()).then(() => {
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = original), 1800);
  });
});

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
    volunteerUnit: data.volunteer === "Yes" ? data.volunteerUnit || "" : "",
    submittedAt: serverTimestamp()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  statusMsg.textContent = "";

  try {
    await addDoc(collection(db, REGISTRATIONS_COLLECTION), payload);
    successOverlay.classList.add("show");
  } catch (err) {
    console.error("Registration failed:", err);
    statusMsg.textContent = "Something went wrong — check your connection and try again.";
    statusMsg.style.color = "#C24444";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Registration 🔥";
  }
});

closeSuccess.addEventListener("click", () => {
  successOverlay.classList.remove("show");
  form.reset();
  feeOtherBlock.classList.remove("show");
  volunteerBlock.classList.remove("show");
  showStep(0);
});
