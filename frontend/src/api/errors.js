const commonMessages = Object.freeze({
  NETWORK_ERROR: "Unable to reach Medzone. Please try again.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait and try again.",
  VALIDATION_ERROR: "Please check the information entered and try again.",
});

const workflowMessages = Object.freeze({
  appointment: {
    APPOINTMENT_IN_PAST: "Please choose a future appointment date and time.",
    APPOINTMENTS_UNAVAILABLE: "Unable to request your appointment. Please try again.",
    APPOINTMENT_SERVICE_NOT_FOUND: "The selected service is no longer available.",
    PATIENT_PROFILE_NOT_FOUND: "Your patient profile could not be found.",
    SLOT_UNAVAILABLE: "That appointment time is no longer available. Please choose another time.",
  },
  auth: {
    AUTHENTICATION_UNAVAILABLE: "Patient access is temporarily unavailable. Please try again.",
    EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
    INVALID_CREDENTIALS: "Invalid email or password.",
  },
  availability: {
    APPOINTMENTS_UNAVAILABLE: "Unable to load available appointment times. Please try again.",
    APPOINTMENT_SERVICE_NOT_FOUND: "The selected service is no longer available.",
  },
  contact: {
    CONTACT_MESSAGES_UNAVAILABLE: "Unable to send your message. Please try again.",
  },
  logout: {
    AUTHENTICATION_UNAVAILABLE: "Unable to log out right now. Please try again.",
  },
  profile: {
    PATIENT_PROFILE_NOT_FOUND: "Your patient profile could not be found.",
    PATIENT_PROFILE_UNAVAILABLE: "Unable to load your patient profile. Please try again.",
  },
  services: {
    SERVICE_CATALOG_UNAVAILABLE: "Unable to load hospital services. Please try again.",
  },
});

export function messageForError(error, workflow) {
  if (error?.code && workflowMessages[workflow]?.[error.code]) {
    return workflowMessages[workflow][error.code];
  }
  if (error?.code && commonMessages[error.code]) return commonMessages[error.code];
  return "Something went wrong. Please try again.";
}

export function isExpiredSession(error) {
  return error?.status === 401
    || error?.code === "AUTHENTICATION_REQUIRED"
    || error?.code === "INVALID_SESSION";
}
