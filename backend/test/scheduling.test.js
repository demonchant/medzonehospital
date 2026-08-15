import assert from "node:assert/strict";
import test from "node:test";
import { calculateAvailableSlots, dayOfWeek } from "../src/utils/scheduling.js";

test("availability uses service duration as its slot grid and removes all overlaps", () => {
  const slots = calculateAvailableSlots({
    date: "2035-05-14",
    durationMinutes: 30,
    operatingPeriods: [{ opensAt: "09:00:00", closesAt: "12:00:00" }],
    blockedPeriods: [{ startsAt: "09:25:00", endsAt: "09:40:00" }],
    appointments: [{ appointmentTime: "10:15:00", durationMinutes: 30 }],
    now: { date: "2035-05-13", minutes: 1_000 },
  });

  assert.deepEqual(slots, ["11:00", "11:30"]);
});

test("full-day blocks and past dates return no slots", () => {
  const common = {
    durationMinutes: 45,
    operatingPeriods: [{ opensAt: "09:00:00", closesAt: "12:00:00" }],
    appointments: [],
    now: { date: "2035-05-14", minutes: 0 },
  };
  assert.deepEqual(calculateAvailableSlots({
    ...common,
    date: "2035-05-14",
    blockedPeriods: [{ startsAt: null, endsAt: null }],
  }), []);
  assert.deepEqual(calculateAvailableSlots({
    ...common,
    date: "2035-05-13",
    blockedPeriods: [],
  }), []);
});

test("midnight-to-midnight operating periods support 24-hour services", () => {
  const slots = calculateAvailableSlots({
    date: "2035-05-14",
    durationMinutes: 60,
    operatingPeriods: [{ opensAt: "00:00:00", closesAt: "00:00:00" }],
    blockedPeriods: [],
    appointments: [],
    now: { date: "2035-05-13", minutes: 0 },
  });
  assert.equal(slots.length, 24);
  assert.equal(slots[0], "00:00");
  assert.equal(slots.at(-1), "23:00");
});

test("weekday calculation is stable and independent of server locale", () => {
  assert.equal(dayOfWeek("2035-05-13"), 0);
  assert.equal(dayOfWeek("2035-05-14"), 1);
});
