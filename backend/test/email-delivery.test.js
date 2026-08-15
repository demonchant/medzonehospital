import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadEmailConfig } from "../src/config/email.js";
import { createLoggerOptions } from "../src/config/logger.js";
import { runMigrations } from "../src/database/migrator.js";
import { createEmailProcessor } from "../src/email/processor.js";
import { createSmtpTransport } from "../src/email/smtp-transport.js";
import { renderNotificationEmail } from "../src/email/templates.js";
import { createRepositories } from "../src/repositories/index.js";
import { createTestDatabase } from "../test-utils/database.js";

const emailEnvironment = Object.freeze({
  EMAIL_HOST: "smtp.example.test",
  EMAIL_PORT: "465",
  EMAIL_USERNAME: "hospital@example.test",
  EMAIL_PASSWORD: "never-log-this-secret",
});

async function enqueue(repositories, overrides = {}) {
  const aggregateId = overrides.aggregateId ?? randomUUID();
  return repositories.notifications.enqueue({
    eventKey: overrides.eventKey ?? `APPOINTMENT_REMINDER:${aggregateId}:patient`,
    eventType: overrides.eventType ?? "APPOINTMENT_REMINDER",
    audience: overrides.audience ?? "PATIENT",
    recipientUserId: null,
    recipientEmail: overrides.recipientEmail ?? `${aggregateId}@example.test`,
    aggregateType: overrides.aggregateType ?? "APPOINTMENT",
    aggregateId,
    payload: overrides.payload ?? {
      appointmentId: aggregateId,
      serviceId: randomUUID(),
      appointmentDate: "2026-09-01",
      appointmentTime: "09:30",
      serviceName: "General Consultation",
    },
  });
}

test("email configuration is backend-only, validated, and redacted", () => {
  const config = loadEmailConfig(emailEnvironment);
  assert.equal(config.EMAIL_PORT, 465);
  assert.equal(config.secure, true);
  assert.equal(loadEmailConfig({ ...emailEnvironment, EMAIL_PORT: "587" }).secure, false);
  assert.throws(
    () => loadEmailConfig({ ...emailEnvironment, EMAIL_PASSWORD: "" }),
    /Invalid email configuration/,
  );
  assert.ok(createLoggerOptions({ LOG_LEVEL: "info" }).redact.paths.includes("EMAIL_PASSWORD"));
});

test("all Phase 12 events map to the four approved role-specific email use cases", () => {
  const expected = new Map([
    ["APPOINTMENT_REQUESTED", "appointment-confirmation"],
    ["APPOINTMENT_CONFIRMED", "appointment-confirmation"],
    ["STAFF_NEW_APPOINTMENT", "appointment-confirmation"],
    ["APPOINTMENT_CANCELLED", "appointment-cancelled"],
    ["STAFF_APPOINTMENT_CANCELLED", "appointment-cancelled"],
    ["APPOINTMENT_REMINDER", "appointment-reminder"],
    ["STAFF_CONTACT_MESSAGE", "contact-received"],
  ]);
  const subjects = new Set();
  for (const [eventType, useCase] of expected) {
    const rendered = renderNotificationEmail({
      eventType,
      aggregateId: randomUUID(),
      payload: {
        appointmentDate: "2026-09-01",
        appointmentTime: "09:30",
        serviceName: "<script>unsafe</script>",
      },
    });
    assert.equal(rendered.useCase, useCase);
    assert.ok(!rendered.html.includes("<script>unsafe</script>"));
    subjects.add(rendered.subject);
  }
  assert.equal(subjects.size, 7);
});

test("SMTP transport uses approved credentials and sender without exposing the password", async () => {
  let transportOptions;
  let outgoing;
  const config = loadEmailConfig(emailEnvironment);
  const transport = createSmtpTransport(config, (options) => {
    transportOptions = options;
    return { async sendMail(message) { outgoing = message; return { messageId: "test-id" }; } };
  });
  await transport.send({
    to: "patient@example.test",
    subject: "Appointment confirmed",
    text: "Confirmed",
    html: "<p>Confirmed</p>",
  });

  assert.deepEqual(transportOptions, {
    host: "smtp.example.test",
    port: 465,
    secure: true,
    auth: { user: "hospital@example.test", pass: "never-log-this-secret" },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  assert.equal(outgoing.from, "hospital@example.test");
  assert.equal(outgoing.to, "patient@example.test");
  assert.ok(!JSON.stringify(outgoing).includes(emailEnvironment.EMAIL_PASSWORD));
});

test("delivery acknowledges success, terminally fails errors, and does not retry", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database, { useAdvisoryLock: false });
  const repositories = createRepositories(database);
  await enqueue(repositories, { recipientEmail: "success@example.test" });
  await enqueue(repositories, { recipientEmail: "failure@example.test" });
  const logs = [];
  const processor = createEmailProcessor({
    database,
    logger: { warn(context, message) { logs.push({ context, message }); } },
    transport: {
      async send(message) {
        if (message.to === "failure@example.test") {
          const error = new Error(`SMTP rejected ${emailEnvironment.EMAIL_PASSWORD}`);
          error.code = "SMTP_REJECTED";
          throw error;
        }
      },
    },
  });

  assert.deepEqual(await processor.processBatch(), { claimed: 2, failed: 1, sent: 1 });
  assert.deepEqual(await processor.processBatch(), { claimed: 0, failed: 0, sent: 0 });
  const result = await database.query(`
    SELECT recipient_email, status, claimed_at, sent_at, failed_at, failure_reason
    FROM notification_outbox ORDER BY recipient_email
  `);
  assert.equal(result.rows[0].recipient_email, "failure@example.test");
  assert.equal(result.rows[0].status, "FAILED");
  assert.ok(result.rows[0].claimed_at);
  assert.ok(result.rows[0].failed_at);
  assert.equal(result.rows[0].sent_at, null);
  assert.equal(result.rows[0].failure_reason, "SMTP_REJECTED");
  assert.equal(result.rows[1].status, "SENT");
  assert.ok(result.rows[1].sent_at);
  assert.equal(JSON.stringify(logs).includes(emailEnvironment.EMAIL_PASSWORD), false);
});

test("concurrent consumers claim each pending notification at most once", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database, { useAdvisoryLock: false });
  const repositories = createRepositories(database);
  const recipients = Array.from({ length: 8 }, (_, index) => `recipient-${index}@example.test`);
  for (const recipientEmail of recipients) await enqueue(repositories, { recipientEmail });

  const deliveries = [];
  const transport = { async send(message) { deliveries.push(message.to); } };
  const first = createEmailProcessor({ database, transport });
  const second = createEmailProcessor({ database, transport });
  const results = await Promise.all([first.processBatch(4), second.processBatch(4)]);
  assert.equal(results.reduce((total, result) => total + result.claimed, 0), 8);
  assert.equal(deliveries.length, 8);
  assert.equal(new Set(deliveries).size, 8);
  const statuses = await database.query(`
    SELECT status, count(*)::int AS count FROM notification_outbox GROUP BY status
  `);
  assert.deepEqual(statuses.rows, [{ status: "SENT", count: 8 }]);
});
