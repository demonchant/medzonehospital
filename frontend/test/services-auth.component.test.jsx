import assert from "node:assert/strict";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { test, vi } from "vitest";
import { api } from "../src/api/client";
import { useServices } from "../src/api/useServices";
import AuthProvider from "../src/auth/AuthProvider";
import { useAuth } from "../src/auth/useAuth";

function ServicesProbe() {
  const { error, loading, retry, services } = useServices();
  if (loading) return <p>loading</p>;
  if (error) return <button onClick={retry}>retry</button>;
  return <p>{services.map((service) => service.name).join(",")}</p>;
}

function AuthProbe() {
  const { identity, login, logout, retrySession, status } = useAuth();
  return (
    <div>
      <p>{status}:{identity?.email ?? "none"}</p>
      <button onClick={() => login({ email: "patient@example.com", password: "password" })}>login</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => retrySession()}>retry session</button>
    </div>
  );
}

test("useServices reports failures, retries, and aborts obsolete reads", async () => {
  const list = vi.spyOn(api.services, "list")
    .mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "NETWORK_ERROR" }))
    .mockResolvedValueOnce([{ id: "service-1", name: "General Medicine" }]);
  const { unmount } = render(<ServicesProbe />);

  assert.equal(screen.getByText("loading").textContent, "loading");
  await screen.findByRole("button", { name: "retry" });
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  await screen.findByText("General Medicine");

  assert.equal(list.mock.calls.length, 2);
  assert.equal(list.mock.calls[0][0] instanceof AbortSignal, true);
  const latestSignal = list.mock.calls[1][0];
  unmount();
  assert.equal(latestSignal.aborted, true);
});

test("AuthProvider distinguishes unavailable and anonymous sessions and supports retry", async () => {
  const current = vi.spyOn(api.auth, "current")
    .mockRejectedValueOnce({ status: 503 })
    .mockRejectedValueOnce({ status: 401 });
  render(<AuthProvider><AuthProbe /></AuthProvider>);

  await screen.findByText("unavailable:none");
  fireEvent.click(screen.getByRole("button", { name: "retry session" }));
  await screen.findByText("anonymous:none");
  assert.equal(current.mock.calls.length, 2);
});

test("AuthProvider establishes and clears authenticated identity", async () => {
  vi.spyOn(api.auth, "current").mockRejectedValue({ status: 401 });
  const identity = { email: "patient@example.com", role: "PATIENT" };
  const login = vi.spyOn(api.auth, "login").mockResolvedValue(identity);
  const logout = vi.spyOn(api.auth, "logout").mockResolvedValue(null);
  render(<AuthProvider><AuthProbe /></AuthProvider>);

  await screen.findByText("anonymous:none");
  fireEvent.click(screen.getByRole("button", { name: "login" }));
  await screen.findByText("authenticated:patient@example.com");
  fireEvent.click(screen.getByRole("button", { name: "logout" }));
  await waitFor(() => assert.equal(screen.getByText("anonymous:none").textContent, "anonymous:none"));

  assert.deepEqual(login.mock.calls[0][0], { email: "patient@example.com", password: "password" });
  assert.equal(logout.mock.calls.length, 1);
});
