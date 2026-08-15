import assert from "node:assert/strict";
import { test } from "node:test";
import { isExpiredSession, messageForError } from "../src/api/errors.js";

test("slot conflicts use the exact Phase 17 recovery message", () => {
  assert.equal(
    messageForError({ code: "SLOT_UNAVAILABLE", message: "internal wording" }, "appointment"),
    "That appointment time is no longer available. Please choose another time.",
  );
});

test("workflow mappings do not expose arbitrary backend messages", () => {
  const arbitrary = "database host and internal stack detail";
  assert.equal(
    messageForError({ code: "UNKNOWN_INTERNAL_CODE", message: arbitrary }, "contact"),
    "Something went wrong. Please try again.",
  );
  assert.equal(messageForError({ code: "VALIDATION_ERROR" }, "contact"),
    "Please check the information entered and try again.");
  assert.equal(messageForError({ code: "NETWORK_ERROR" }, "services"),
    "Unable to reach Medzone. Please try again.");
});

test("expired session detection covers the established status and codes", () => {
  assert.equal(isExpiredSession({ status: 401 }), true);
  assert.equal(isExpiredSession({ code: "INVALID_SESSION" }), true);
  assert.equal(isExpiredSession({ code: "AUTHENTICATION_REQUIRED" }), true);
  assert.equal(isExpiredSession({ code: "FORBIDDEN", status: 403 }), false);
});

test("each integrated workflow maps its established safe errors", () => {
  const cases = [
    ["auth", "INVALID_CREDENTIALS", "Invalid email or password."],
    ["profile", "PATIENT_PROFILE_UNAVAILABLE", "Unable to load your patient profile. Please try again."],
    ["availability", "APPOINTMENTS_UNAVAILABLE", "Unable to load available appointment times. Please try again."],
    ["contact", "CONTACT_MESSAGES_UNAVAILABLE", "Unable to send your message. Please try again."],
    ["logout", "AUTHENTICATION_UNAVAILABLE", "Unable to log out right now. Please try again."],
    ["services", "SERVICE_CATALOG_UNAVAILABLE", "Unable to load hospital services. Please try again."],
  ];

  for (const [workflow, code, expected] of cases) {
    assert.equal(messageForError({ code, message: "internal detail" }, workflow), expected);
  }
});
