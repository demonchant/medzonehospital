import assert from "node:assert/strict";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { api } from "../src/api/client";
import { AuthContext } from "../src/auth/context";
import AppointmentAuth from "../src/components/AppointmentAuth";
import ContactPage from "../src/pages/ContactPage";

afterEach(() => {
  vi.useRealTimers();
});

function change(name, value) {
  fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { name, value } });
}

test("contact submission exposes pending and timed success states", async () => {
  vi.useFakeTimers();
  let resolveSubmission;
  const submit = vi.spyOn(api.contact, "submit").mockImplementation(() => new Promise((resolve) => {
    resolveSubmission = resolve;
  }));
  render(<ContactPage />);

  change("name", "Patient Name");
  change("email", "patient@example.com");
  change("subject", "Question");
  change("message", "Operational question");
  fireEvent.submit(document.querySelector("form"));

  assert.equal(document.querySelector("form").getAttribute("aria-busy"), "true");
  assert.equal(screen.getByRole("button", { name: "Sending..." }).disabled, true);
  await act(async () => resolveSubmission({ id: "message-1" }));

  assert.deepEqual(submit.mock.calls[0][0], {
    email: "patient@example.com",
    message: "Operational question",
    name: "Patient Name",
    subject: "Question",
  });
  assert.equal(screen.getByRole("status").getAttribute("aria-live"), "polite");
  assert.equal(screen.getByText("Message Sent!").textContent, "Message Sent!");

  await act(async () => vi.advanceTimersByTime(5000));
  assert.equal(screen.queryByText("Message Sent!"), null);
});

test("contact failures never expose arbitrary backend messages", async () => {
  vi.spyOn(api.contact, "submit").mockRejectedValue({
    code: "UNKNOWN_INTERNAL_CODE",
    message: "database host and internal stack detail",
  });
  render(<ContactPage />);
  change("name", "Patient Name");
  change("email", "patient@example.com");
  change("subject", "Question");
  change("message", "Operational question");
  fireEvent.submit(document.querySelector("form"));

  assert.equal((await screen.findByRole("alert")).textContent, "Something went wrong. Please try again.");
  assert.equal(document.body.textContent.includes("database host"), false);
});

test("patient registration returns to login and preserves only the email", async () => {
  const register = vi.spyOn(api.auth, "register").mockResolvedValue({ id: "patient-1" });
  const login = vi.fn();
  render(
    <AuthContext.Provider value={{ login }}>
      <AppointmentAuth onAuthenticated={vi.fn()} sessionMessage="" />
    </AuthContext.Provider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Create a patient account" }));
  change("firstName", "Patient");
  change("lastName", "Name");
  change("phone", "+2348000000000");
  change("email", "patient@example.com");
  change("password", "long-password");
  fireEvent.submit(document.querySelector("form"));

  await screen.findByText("Registration successful. Please log in to book your appointment.");
  assert.deepEqual(register.mock.calls[0][0], {
    email: "patient@example.com",
    firstName: "Patient",
    lastName: "Name",
    password: "long-password",
    phone: "+2348000000000",
  });
  assert.equal(document.querySelector('[name="email"]').value, "patient@example.com");
  assert.equal(document.querySelector('[name="password"]').value, "");
  assert.equal(document.querySelector('[name="firstName"]'), null);
});

test("patient login reports pending state and invokes the authenticated callback", async () => {
  let resolveLogin;
  const login = vi.fn(() => new Promise((resolve) => { resolveLogin = resolve; }));
  const onAuthenticated = vi.fn();
  render(
    <AuthContext.Provider value={{ login }}>
      <AppointmentAuth onAuthenticated={onAuthenticated} sessionMessage="Your session has expired." />
    </AuthContext.Provider>,
  );
  change("email", "patient@example.com");
  change("password", "password");
  fireEvent.submit(document.querySelector("form"));

  assert.equal(screen.getByRole("button", { name: "Please wait..." }).getAttribute("aria-busy"), "true");
  assert.equal(screen.getByRole("alert").textContent, "Your session has expired.");
  await act(async () => resolveLogin({ role: "PATIENT" }));
  assert.deepEqual(login.mock.calls[0][0], { email: "patient@example.com", password: "password" });
  assert.equal(onAuthenticated.mock.calls.length, 1);
});
