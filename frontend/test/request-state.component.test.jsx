import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import { ErrorState, LoadingState } from "../src/components/RequestState";

test("loading and error states expose status semantics and retry interaction", () => {
  const retry = vi.fn();
  const { rerender } = render(<LoadingState>Loading services...</LoadingState>);

  const status = screen.getByRole("status");
  assert.equal(status.textContent, "Loading services...");
  assert.equal(status.getAttribute("aria-live"), "polite");

  rerender(<ErrorState message="Unable to load services." onRetry={retry} />);
  assert.equal(screen.getByRole("alert").textContent.includes("Unable to load services."), true);
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  assert.equal(retry.mock.calls.length, 1);
});

test("error states omit the retry control when no retry is available", () => {
  render(<ErrorState message="Unable to continue." />);
  assert.equal(screen.queryByRole("button", { name: "Try Again" }), null);
});
