import assert from "node:assert/strict";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, test, vi } from "vitest";
import { api } from "../src/api/client";
import AppointmentPage from "../src/pages/AppointmentPage";

const hookMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useServices: vi.fn(),
}));

vi.mock("../src/auth/useAuth", () => ({ useAuth: hookMocks.useAuth }));
vi.mock("../src/api/useServices", () => ({ useServices: hookMocks.useServices }));

let authState;

beforeEach(() => {
  authState = {
    identity: { email: "patient@example.com", role: "PATIENT" },
    invalidateSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(null),
    retrySession: vi.fn(),
    status: "authenticated",
  };
  hookMocks.useAuth.mockImplementation(() => authState);
  hookMocks.useServices.mockReturnValue({
    error: null,
    loading: false,
    retry: vi.fn(),
    services: [{ id: "service-1", name: "General Medicine" }],
  });
  vi.spyOn(api.patients, "ownProfile").mockResolvedValue({
    firstName: "Patient",
    lastName: "Name",
    phone: "+2348000000000",
  });
});

function change(name, value) {
  fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { name, value } });
}

async function completeBookingForm() {
  await screen.findByText("Booking as Patient Name");
  change("serviceId", "service-1");
  change("appointmentDate", "2026-08-20");
  await screen.findByRole("option", { name: "10:00" });
  change("appointmentTime", "10:00");
  change("notes", "  Operational concern  ");
}

test("appointment access renders session states and retries unavailable access", () => {
  authState.status = "checking";
  authState.identity = null;
  const { rerender } = render(<AppointmentPage />);
  assert.equal(screen.getByRole("status").textContent, "Checking your patient session...");

  authState.status = "unavailable";
  rerender(<AppointmentPage />);
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  assert.equal(authState.retrySession.mock.calls.length, 1);

  authState.status = "authenticated";
  authState.identity = { role: "ADMIN" };
  rerender(<AppointmentPage />);
  assert.equal(screen.getByRole("alert").textContent, "A patient account is required to book an appointment.");
});

test("slot conflicts retain the draft, clear only time, refresh availability, and allow success", async () => {
  const availability = vi.spyOn(api.appointments, "availability").mockResolvedValue({ slots: ["10:00"] });
  const book = vi.spyOn(api.appointments, "book")
    .mockRejectedValueOnce({ code: "SLOT_UNAVAILABLE", status: 409 })
    .mockResolvedValueOnce({ id: "appointment-1" });
  render(<AppointmentPage />);
  await completeBookingForm();

  fireEvent.submit(document.querySelector("form"));
  const alert = await screen.findByRole("alert");
  assert.equal(alert.textContent, "That appointment time is no longer available. Please choose another time.");
  assert.equal(document.querySelector('[name="appointmentTime"]').value, "");
  assert.equal(document.querySelector('[name="serviceId"]').value, "service-1");
  assert.equal(document.querySelector('[name="appointmentDate"]').value, "2026-08-20");
  assert.equal(document.querySelector('[name="notes"]').value, "  Operational concern  ");
  await waitFor(() => assert.equal(availability.mock.calls.length, 2));

  await screen.findByRole("option", { name: "10:00" });
  change("appointmentTime", "10:00");
  fireEvent.submit(document.querySelector("form"));
  await screen.findByText("Appointment Requested!");
  assert.deepEqual(book.mock.calls[1][0], {
    appointmentDate: "2026-08-20",
    appointmentTime: "10:00",
    notes: "Operational concern",
    serviceId: "service-1",
  });

  fireEvent.click(screen.getByRole("button", { name: "Book Another Appointment" }));
  await screen.findByText("Booking as Patient Name");
  assert.equal(document.querySelector('[name="serviceId"]').value, "");
});

test("expired sessions preserve an in-memory appointment draft across explicit login", async () => {
  vi.spyOn(api.appointments, "availability").mockResolvedValue({ slots: ["10:00"] });
  vi.spyOn(api.appointments, "book").mockRejectedValue({ code: "INVALID_SESSION", status: 401 });
  const { rerender } = render(<AppointmentPage />);
  await completeBookingForm();
  fireEvent.submit(document.querySelector("form"));
  await waitFor(() => assert.equal(authState.invalidateSession.mock.calls.length, 1));

  authState.status = "anonymous";
  authState.identity = null;
  rerender(<AppointmentPage />);
  assert.equal(screen.getByRole("alert").textContent, "Your session has expired. Please log in again.");

  authState.status = "authenticated";
  authState.identity = { email: "patient@example.com", role: "PATIENT" };
  rerender(<AppointmentPage />);
  await screen.findByText("Booking as Patient Name");
  assert.equal(document.querySelector('[name="serviceId"]').value, "service-1");
  assert.equal(document.querySelector('[name="appointmentDate"]').value, "2026-08-20");
  await screen.findByRole("option", { name: "10:00" });
  assert.equal(document.querySelector('[name="appointmentTime"]').value, "10:00");
  assert.equal(document.querySelector('[name="notes"]').value, "  Operational concern  ");
});

test("intentional logout clears the appointment draft", async () => {
  vi.spyOn(api.appointments, "availability").mockResolvedValue({ slots: ["10:00"] });
  const { rerender } = render(<AppointmentPage />);
  await completeBookingForm();
  fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
  await waitFor(() => assert.equal(authState.logout.mock.calls.length, 1));

  authState.status = "anonymous";
  authState.identity = null;
  rerender(<AppointmentPage />);
  authState.status = "authenticated";
  authState.identity = { email: "patient@example.com", role: "PATIENT" };
  rerender(<AppointmentPage />);
  await screen.findByText("Booking as Patient Name");
  assert.equal(document.querySelector('[name="serviceId"]').value, "");
  assert.equal(document.querySelector('[name="appointmentDate"]').value, "");
  assert.equal(document.querySelector('[name="notes"]').value, "");
});

test("changing availability inputs aborts the obsolete request", async () => {
  const pending = [];
  vi.spyOn(api.appointments, "availability").mockImplementation((serviceId, date, signal) => (
    new Promise((resolve, reject) => {
      pending.push({ date, resolve, serviceId, signal });
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })
  ));
  render(<AppointmentPage />);
  await screen.findByText("Booking as Patient Name");
  change("serviceId", "service-1");
  change("appointmentDate", "2026-08-20");
  await waitFor(() => assert.equal(pending.length, 1));

  change("appointmentDate", "2026-08-21");
  await waitFor(() => assert.equal(pending.length, 2));
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ slots: ["11:00"] });
  await screen.findByRole("option", { name: "11:00" });
  assert.equal(screen.queryByRole("option", { name: "10:00" }), null);
});
