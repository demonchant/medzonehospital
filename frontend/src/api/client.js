const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL || "/api";
const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");

export class ApiError extends Error {
  constructor({ code, details, message, requestId, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.status = status;
  }
}

async function apiRequest(path, { body, method = "GET", signal } = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      method,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: "Unable to reach Medzone. Please try again.",
      status: 0,
    });
  }

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      throw new ApiError({
        code: "INVALID_RESPONSE",
        message: "Medzone returned an invalid response.",
        status: response.status,
      });
    }
  }

  if (!response.ok) {
    throw new ApiError({
      code: payload?.error?.code || "REQUEST_FAILED",
      details: payload?.error?.details,
      message: payload?.error?.message || "The request could not be completed.",
      requestId: payload?.error?.requestId,
      status: response.status,
    });
  }

  return payload;
}

export const api = Object.freeze({
  appointments: {
    availability(serviceId, date, signal) {
      const query = new URLSearchParams({ serviceId, date });
      return apiRequest(`/appointments/availability?${query}`, { signal });
    },
    book(input) {
      return apiRequest("/appointments", { body: input, method: "POST" });
    },
  },
  auth: {
    current(signal) {
      return apiRequest("/auth/me", { signal });
    },
    login(input) {
      return apiRequest("/auth/login", { body: input, method: "POST" });
    },
    logout() {
      return apiRequest("/auth/logout", { method: "POST" });
    },
    register(input) {
      return apiRequest("/auth/register", { body: input, method: "POST" });
    },
  },
  contact: {
    submit(input) {
      return apiRequest("/contact", { body: input, method: "POST" });
    },
  },
  patients: {
    ownProfile(signal) {
      return apiRequest("/patients/me", { signal });
    },
  },
  services: {
    list(signal) {
      return apiRequest("/services", { signal });
    },
  },
});
