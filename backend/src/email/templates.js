const mappings = Object.freeze({
  APPOINTMENT_REQUESTED: {
    useCase: "appointment-confirmation",
    subject: "Appointment request received",
    heading: "Your appointment request was received",
    introduction: "We have received your appointment request.",
  },
  APPOINTMENT_CONFIRMED: {
    useCase: "appointment-confirmation",
    subject: "Appointment confirmed",
    heading: "Your appointment is confirmed",
    introduction: "Your appointment has been confirmed.",
  },
  STAFF_NEW_APPOINTMENT: {
    useCase: "appointment-confirmation",
    subject: "New appointment request",
    heading: "A new appointment was requested",
    introduction: "A new appointment requires operational review.",
  },
  APPOINTMENT_CANCELLED: {
    useCase: "appointment-cancelled",
    subject: "Appointment cancelled",
    heading: "Your appointment was cancelled",
    introduction: "Your appointment is now cancelled.",
  },
  STAFF_APPOINTMENT_CANCELLED: {
    useCase: "appointment-cancelled",
    subject: "Appointment cancellation",
    heading: "An appointment was cancelled",
    introduction: "An appointment cancellation was recorded.",
  },
  APPOINTMENT_REMINDER: {
    useCase: "appointment-reminder",
    subject: "Appointment reminder",
    heading: "Upcoming appointment reminder",
    introduction: "This is a reminder about your upcoming appointment.",
  },
  STAFF_CONTACT_MESSAGE: {
    useCase: "contact-received",
    subject: "New contact message received",
    heading: "A new contact message was received",
    introduction: "A new contact message is ready for administrative review.",
  },
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appointmentDetails(payload) {
  if (!payload.appointmentDate) return [];
  return [
    `Service: ${payload.serviceName}`,
    `Date: ${payload.appointmentDate}`,
    `Time: ${payload.appointmentTime}`,
  ];
}

export function renderNotificationEmail(notification) {
  const mapping = mappings[notification.eventType];
  if (!mapping) throw new Error(`Unsupported notification event: ${notification.eventType}`);
  const details = appointmentDetails(notification.payload);
  const reference = `Reference: ${notification.aggregateId}`;
  const lines = [mapping.introduction, ...details, reference];
  return {
    useCase: mapping.useCase,
    subject: mapping.subject,
    text: lines.join("\n"),
    html: `<!doctype html><html><body><h1>${escapeHtml(mapping.heading)}</h1>${lines
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}</body></html>`,
  };
}
