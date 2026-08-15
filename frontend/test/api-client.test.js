import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, api } from "../src/api/client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("contact submissions use the public API contract and credentialed requests", async () => {
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { options, url };
    return new Response(JSON.stringify({
      createdAt: "2026-08-15T00:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000001",
      status: "UNREAD",
    }), { headers: { "content-type": "application/json" }, status: 201 });
  };

  const input = { email: "patient@example.com", message: "Operational question", name: "Patient Name", subject: "Question" };
  await api.contact.submit(input);

  assert.equal(captured.url, "/api/contact");
  assert.equal(captured.options.credentials, "include");
  assert.equal(captured.options.method, "POST");
  assert.deepEqual(JSON.parse(captured.options.body), input);
});

test("appointment booking sends only the established appointment contract", async () => {
  let payload;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 201,
    });
  };

  await api.appointments.book({
    appointmentDate: "2026-08-20",
    appointmentTime: "10:00",
    notes: null,
    serviceId: "00000000-0000-4000-8000-000000000002",
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    "appointmentDate", "appointmentTime", "notes", "serviceId",
  ]);
  assert.equal("fullName" in payload, false);
  assert.equal("phone" in payload, false);
});

test("backend errors retain their controlled code, message, and request id", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      code: "SLOT_UNAVAILABLE",
      message: "That appointment time is not available",
      requestId: "request-1",
    },
  }), { headers: { "content-type": "application/json" }, status: 409 });

  await assert.rejects(
    api.appointments.book({}),
    (error) => error instanceof ApiError
      && error.code === "SLOT_UNAVAILABLE"
      && error.status === 409
      && error.requestId === "request-1",
  );
});

test("malformed JSON responses become controlled API errors", async () => {
  globalThis.fetch = async () => new Response("not-json", {
    headers: { "content-type": "application/json" },
    status: 502,
  });

  await assert.rejects(
    api.services.list(),
    (error) => error instanceof ApiError
      && error.code === "INVALID_RESPONSE"
      && error.status === 502,
  );
});

test("read endpoints preserve credentialed requests, signals, and encoded availability queries", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ options, url });
    return new Response(JSON.stringify(url.includes("availability") ? { slots: [] } : []), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };
  const controller = new AbortController();

  await api.services.list(controller.signal);
  await api.patients.ownProfile(controller.signal);
  await api.auth.current(controller.signal);
  await api.appointments.availability("service id", "2026-08-20", controller.signal);

  assert.deepEqual(calls.map(({ url }) => url), [
    "/api/services",
    "/api/patients/me",
    "/api/auth/me",
    "/api/appointments/availability?serviceId=service+id&date=2026-08-20",
  ]);
  for (const { options } of calls) {
    assert.equal(options.credentials, "include");
    assert.equal(options.method, "GET");
    assert.equal(options.signal, controller.signal);
  }
});

test("authentication mutations use only their established contracts", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ options, url });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };
  const registration = {
    email: "patient@example.com",
    firstName: "Patient",
    lastName: "Name",
    password: "long-password",
    phone: "+2348000000000",
  };
  const credentials = { email: registration.email, password: registration.password };

  await api.auth.register(registration);
  await api.auth.login(credentials);
  await api.auth.logout();

  assert.deepEqual(calls.map(({ url }) => url), [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/logout",
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body), registration);
  assert.deepEqual(JSON.parse(calls[1].options.body), credentials);
  assert.equal(calls[2].options.body, undefined);
  for (const { options } of calls) assert.equal(options.method, "POST");
});

test("network failures become safe errors while request cancellation remains distinguishable", async () => {
  globalThis.fetch = async () => { throw new Error("socket detail"); };
  await assert.rejects(
    api.services.list(),
    (error) => error instanceof ApiError
      && error.code === "NETWORK_ERROR"
      && error.status === 0
      && !error.message.includes("socket detail"),
  );

  const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
  globalThis.fetch = async () => { throw abortError; };
  await assert.rejects(api.services.list(), (error) => error === abortError);
});

test("successful non-JSON responses return a controlled null payload", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api.auth.logout(), null);
});
