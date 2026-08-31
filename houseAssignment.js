// ============================================================
// houseAssignment.js — Shared house-assignment logic for NYC 2026
// Used by both the public registration form (script.js) and the
// staff check-in desk (check-in.html).
//
// ONE-TIME SETUP: seed these 10 documents in Firestore
// collection "houseCounts" before the first registration:
//
//   F1 → { name: "Love House",     gender: "Female", capacity: 15, count: 0 }
//   F2 → { name: "Joy House",      gender: "Female", capacity: 15, count: 0 }
//   F3 → { name: "Peace House",    gender: "Female", capacity: 15, count: 0 }
//   F4 → { name: "Goodness House", gender: "Female", capacity: 15, count: 0 }
//   F5 → { name: "Faith House",    gender: "Female", capacity: 15, count: 0 }
//   M1 → { name: "Love House",     gender: "Male",   capacity: 15, count: 0 }
//   M2 → { name: "Joy House",      gender: "Male",   capacity: 15, count: 0 }
//   M3 → { name: "Peace House",    gender: "Male",   capacity: 15, count: 0 }
//   M4 → { name: "Goodness House", gender: "Male",   capacity: 15, count: 0 }
//   M5 → { name: "Faith House",    gender: "Male",   capacity: 15, count: 0 }
//
// The staff page will show "not seeded yet" if any doc is missing.
// ============================================================

import {
  runTransaction,
  increment,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const HOUSE_NAMES = ["Love", "Joy", "Peace", "Goodness", "Faith"];
const CAPACITY = 15;

export const HOUSE_COUNTS_COLLECTION = "houseCounts";

const FEMALE_IDS = ["F1", "F2", "F3", "F4", "F5"];
const MALE_IDS   = ["M1", "M2", "M3", "M4", "M5"];

export function allHouseIds() {
  return [...FEMALE_IDS, ...MALE_IDS];
}

export function houseIdsForGender(gender) {
  const g = (gender || "").toLowerCase();
  if (g === "female") return [...FEMALE_IDS];
  if (g === "male")   return [...MALE_IDS];
  return [];
}

export function houseLabel(gender, index) {
  const ids = houseIdsForGender(gender);
  const id = ids[index];
  if (!id) return "Unknown";
  const name = HOUSE_NAMES[index] || "House";
  return `${id} \u00b7 ${name} House`;
}

function getHouseIndex(houseId) {
  if (!houseId || houseId.length < 2) return -1;
  const num = parseInt(houseId.slice(1), 10);
  return num - 1;
}

const PENDING_LABEL = "Pending \u2014 see registration desk";

/**
 * Atomically create a registration document AND assign a house.
 * If no house is available for the gender, marks as Pending.
 * Returns the house display label (or the Pending string).
 */
export async function createRegistrationWithHouse(db, docRef, payload) {
  const gender = payload.gender;
  const ids = houseIdsForGender(gender);

  if (ids.length === 0) {
    await runTransaction(db, async (t) => {
      t.set(docRef, { ...payload, house: PENDING_LABEL, houseId: null });
    });
    return PENDING_LABEL;
  }

  return await runTransaction(db, async (t) => {
    const houseRefs = ids.map(id => doc(db, HOUSE_COUNTS_COLLECTION, id));
    const houseSnaps = await Promise.all(houseRefs.map(ref => t.get(ref)));

    const available = [];
    houseSnaps.forEach((snap, i) => {
      const data = snap.exists() ? snap.data() : { count: 0, capacity: CAPACITY };
      const count = data.count || 0;
      const cap  = data.capacity || CAPACITY;
      if (count < cap) {
        available.push({ id: ids[i], ref: houseRefs[i], index: i });
      }
    });

    if (available.length === 0) {
      t.set(docRef, { ...payload, house: PENDING_LABEL, houseId: null });
      return PENDING_LABEL;
    }

    const chosen = available[Math.floor(Math.random() * available.length)];
    const label  = houseLabel(gender, chosen.index);

    t.set(docRef, { ...payload, house: label, houseId: chosen.id });
    t.update(chosen.ref, { count: increment(1) });

    return label;
  });
}

/**
 * Assign a house to an existing registration that currently has none.
 * Re-reads the doc inside the transaction so two simultaneous batch
 * runs can never double-assign the same person.
 * Returns the house display label.
 */
export async function assignHouseToExisting(db, docRef, gender) {
  const ids = houseIdsForGender(gender);

  if (ids.length === 0) {
    await runTransaction(db, async (t) => {
      const snap = await t.get(docRef);
      if (snap.exists() && !snap.data().houseId) {
        t.update(docRef, { house: PENDING_LABEL, houseId: null });
      }
    });
    return PENDING_LABEL;
  }

  return await runTransaction(db, async (t) => {
    const regSnap = await t.get(docRef);
    if (!regSnap.exists()) throw new Error("Registration not found");

    // Already assigned — don't reassign
    if (regSnap.data().houseId) {
      return regSnap.data().house || PENDING_LABEL;
    }

    const houseRefs = ids.map(id => doc(db, HOUSE_COUNTS_COLLECTION, id));
    const houseSnaps = await Promise.all(houseRefs.map(ref => t.get(ref)));

    const available = [];
    houseSnaps.forEach((snap, i) => {
      const data = snap.exists() ? snap.data() : { count: 0, capacity: CAPACITY };
      const count = data.count || 0;
      const cap  = data.capacity || CAPACITY;
      if (count < cap) {
        available.push({ id: ids[i], ref: houseRefs[i], index: i });
      }
    });

    if (available.length === 0) {
      t.update(docRef, { house: PENDING_LABEL, houseId: null });
      return PENDING_LABEL;
    }

    const chosen = available[Math.floor(Math.random() * available.length)];
    const label  = houseLabel(gender, chosen.index);

    t.update(docRef, { house: label, houseId: chosen.id });
    t.update(chosen.ref, { count: increment(1) });

    return label;
  });
}

/**
 * Manually move a registrant from one house to another (or unassign).
 * Uses the LIVE houseId from the DB, not the potentially stale caller
 * value, so concurrent staff edits never leak counts.
 * Returns the new house display label (or the Pending string).
 */
export async function manuallySetHouse(db, docRef, /*oldHouseId*/ _, newHouseId, gender) {
  return await runTransaction(db, async (t) => {
    const regSnap = await t.get(docRef);
    if (!regSnap.exists()) throw new Error("Registration not found");

    const liveOldId = regSnap.data().houseId || null;

    // Decrement old house if there was one and we're actually leaving it
    if (liveOldId && liveOldId !== newHouseId) {
      t.update(doc(db, HOUSE_COUNTS_COLLECTION, liveOldId), { count: increment(-1) });
    }

    // Increment new house if we're moving to one
    if (newHouseId) {
      t.update(doc(db, HOUSE_COUNTS_COLLECTION, newHouseId), { count: increment(1) });
      const idx = getHouseIndex(newHouseId);
      const label = houseLabel(gender, idx);
      t.update(docRef, { house: label, houseId: newHouseId });
      return label;
    } else {
      t.update(docRef, { house: PENDING_LABEL, houseId: null });
      return PENDING_LABEL;
    }
  });
}
