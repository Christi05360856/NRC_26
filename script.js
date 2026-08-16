// ============================================================
// FIREBASE CONFIG — replace with your NEW project's config
// (Firebase console → Project settings → your web app → SDK setup)
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
// FEE "OTHERS" TOGGLE
// ============================================================
const feeGrid = document.getElementById("feeGrid");
const feeOtherBlock = document.getElementById("feeOtherBlock");

feeGrid.addEventListener("change", (e) => {
  if (e.target.name === "fee") {
    feeOtherBlock.classList.toggle("show", e.target.value === "Others");
  }
});

// ============================================================
// VOLUNTEER TOGGLE
// ============================================================
const volunteerRadios = document.querySelectorAll('input[name="volunteer"]');
const volunteerBlock = document.getElementById("volunteerBlock");

volunteerRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    volunteerBlock.classList.toggle("show", radio.value === "Yes" && radio.checked);
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
// SCROLL PROGRESS RAIL
// ============================================================
const sections = document.querySelectorAll(".section");
const dots = [1, 2, 3, 4, 5].map((n) => document.getElementById("dot" + n));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = parseInt(entry.target.dataset.track, 10);
        dots.forEach((d, i) => d.classList.toggle("done", i < idx));
      }
    });
  },
  { threshold: 0.4 }
);
sections.forEach((s) => io.observe(s));

// ============================================================
// FORM SUBMIT → FIRESTORE
// ============================================================
const form = document.getElementById("regForm");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");
const successOverlay = document.getElementById("successOverlay");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

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
    feeCategory: data.fee === "Others" ? (data.feeOtherAmount ? `Others: ₦${data.feeOtherAmount}` : "Others") : (data.fee || ""),
    volunteer: data.volunteer || "",
    volunteerUnit: data.volunteer === "Yes" ? (data.volunteerUnit || "") : "",
    submittedAt: serverTimestamp()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  statusMsg.textContent = "";

  try {
    await addDoc(collection(db, REGISTRATIONS_COLLECTION), payload);
    successOverlay.classList.add("show");
    form.reset();
    feeOtherBlock.classList.remove("show");
    volunteerBlock.classList.remove("show");
    dots.forEach((d) => d.classList.remove("done"));
  } catch (err) {
    console.error("Registration failed:", err);
    statusMsg.textContent = "Something went wrong — please check your connection and try again.";
    statusMsg.style.color = "#C0272D";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Registration →";
  }
});
