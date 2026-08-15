import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { dayOfWeek } from "../src/utils/scheduling.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const appointmentDate = "2035-10-02";
const secondDate = "2035-10-03";

async function setup(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    CONTACT_RATE_LIMIT_MAX: "100",
    RATE_LIMIT_MAX: "1000",
  }, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function identity(repositories, role, sequence, status = "ACTIVE") {
  const user = await repositories.users.create({
    email: `notify-${role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: "not-used-by-notification-tests",
    role,
    status,
  });
  const patient = role === "PATIENT" ? await repositories.patients.create({
    userId: user.id,
    firstName: "Notify",
    lastName: `Patient ${sequence}`,
    phone: `+23486${String(sequence).padStart(8, "0")}`,
  }) : null;
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, patient, user };
}

async function scheduledService(database, repositories) {
  const service = await repositories.services.create({
    name: "Phase 12 Notification Service",
    description: "Notification integration fixture",
    category: "Consultation",
    durationMinutes: 30,
  });
  for (const date of [appointmentDate, secondDate]) {
    await database.query(`
      INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
      VALUES ($1, $2, '09:00', '12:00')
      ON CONFLICT DO NOTHING
    `, [service.id, dayOfWeek(date)]);
  }
  return service;
}

function book(app, cookie, serviceId, time = "09:00") {
  return app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie },
    payload: {
      serviceId,
      appointmentDate,
      appointmentTime: time,
      notes: "Not copied to notification payload",
    },
  });
}

function staffAppointmentRequest(app, cookie, method, appointmentId, suffix, payload) {
  return app.inject({
    method,
    url: `/api/staff/appointments/${appointmentId}${suffix}`,
    headers: { cookie },
    ...(payload === undefined ? {} : { payload }),
  });
}

test("booking queues the patient request and active operational new-appointment recipients", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await identity(repositories, "PATIENT", 1);
  const staff = await identity(repositories, "STAFF", 1);
  const admin = await identity(repositories, "ADMIN", 1);
  const inactiveStaff = await identity(repositories, "STAFF", 2, "INACTIVE");
  const service = await scheduledService(database, repositories);

  const response = await book(app, patient.cookie, service.id);
  assert.equal(response.statusCode, 201);
  const notifications = await repositories.notifications.listByAggregate(
    "appointment",
    response.json().id,
  );
  assert.equal(notifications.length, 3);
  const patientNotice = notifications.find((item) => item.eventType === "APPOINTMENT_REQUESTED");
  assert.equal(patientNotice.recipientUserId, patient.user.id);
  assert.equal(patientNotice.recipientEmail, patient.user.email);
  assert.equal(patientNotice.audience, "PATIENT");
  assert.equal(patientNotice.channel, "EMAIL");
  assert.equal(patientNotice.status, "PENDING");
  assert.equal(patientNotice.payload.serviceName, service.name);
  assert.equal(JSON.stringify(patientNotice.payload).includes("Not copied"), false);

  const staffNotices = notifications.filter((item) => item.eventType === "STAFF_NEW_APPOINTMENT");
  assert.deepEqual(
    new Set(staffNotices.map((item) => item.recipientUserId)),
    new Set([staff.user.id, admin.user.id]),
  );
  assert.equal(staffNotices.some((item) => item.recipientUserId === inactiveStaff.user.id), false);
});

test("confirmation and both cancellation paths queue correct idempotent patient/staff events", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await identity(repositories, "PATIENT", 10);
  const otherPatient = await identity(repositories, "PATIENT", 11);
  const staff = await identity(repositories, "STAFF", 10);
  const admin = await identity(repositories, "ADMIN", 10);
  const service = await scheduledService(database, repositories);
  const first = await book(app, patient.cookie, service.id, "09:00");
  const second = await book(app, otherPatient.cookie, service.id, "10:00");

  const confirmed = await staffAppointmentRequest(
    app,
    staff.cookie,
    "PATCH",
    first.json().id,
    "/status",
    { status: "CONFIRMED" },
  );
  assert.equal(confirmed.statusCode, 200);
  const patientCancelled = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${first.json().id}/cancel`,
    headers: { cookie: patient.cookie },
  });
  assert.equal(patientCancelled.statusCode, 200);
  assert.equal((await app.inject({
    method: "PATCH",
    url: `/api/appointments/${first.json().id}/cancel`,
    headers: { cookie: patient.cookie },
  })).statusCode, 200);
  const staffCancelled = await staffAppointmentRequest(
    app,
    admin.cookie,
    "PATCH",
    second.json().id,
    "/cancel",
  );
  assert.equal(staffCancelled.statusCode, 200);

  const firstEvents = await repositories.notifications.listByAggregate("appointment", first.json().id);
  assert.equal(firstEvents.filter((item) => item.eventType === "APPOINTMENT_CONFIRMED").length, 1);
  assert.equal(firstEvents.filter((item) => item.eventType === "APPOINTMENT_CANCELLED").length, 1);
  assert.equal(firstEvents.filter((item) => item.eventType === "STAFF_APPOINTMENT_CANCELLED").length, 2);
  assert.equal(
    firstEvents.find((item) => item.eventType === "APPOINTMENT_CONFIRMED").recipientUserId,
    patient.user.id,
  );

  const secondEvents = await repositories.notifications.listByAggregate("appointment", second.json().id);
  assert.equal(secondEvents.filter((item) => item.eventType === "APPOINTMENT_CANCELLED").length, 1);
  assert.equal(secondEvents.filter((item) => item.eventType === "STAFF_APPOINTMENT_CANCELLED").length, 2);
  assert.ok(firstEvents.concat(secondEvents).every((item) => item.status === "PENDING"));
});

test("contact submission queues staff recipients while persistence stays isolated from delivery", async (t) => {
  const { app, database, repositories } = await setup(t);
  const staff = await identity(repositories, "STAFF", 20);
  const admin = await identity(repositories, "ADMIN", 20);
  await identity(repositories, "PATIENT", 20);

  const response = await app.inject({
    method: "POST",
    url: "/api/contact",
    payload: {
      name: "Visitor",
      email: "visitor@example.com",
      subject: "Question",
      message: "Is the laboratory open?",
    },
  });
  assert.equal(response.statusCode, 201);
  const stored = await repositories.contactMessages.findById(response.json().id);
  assert.equal(stored.message, "Is the laboratory open?");
  const notifications = await repositories.notifications.listByAggregate(
    "contact_message",
    stored.id,
  );
  assert.equal(notifications.length, 2);
  assert.ok(notifications.every((item) => item.eventType === "STAFF_CONTACT_MESSAGE"));
  assert.deepEqual(
    new Set(notifications.map((item) => item.recipientUserId)),
    new Set([staff.user.id, admin.user.id]),
  );
  assert.ok(notifications.every((item) => item.status === "PENDING"));
  assert.equal(JSON.stringify(notifications).includes(stored.message), false);

  const providerColumns = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'notification_outbox' AND column_name = 'provider_id'
  `);
  assert.deepEqual(providerColumns.rows, []);
  const deliveryState = await database.query(`
    SELECT status, claimed_at, sent_at, failed_at
    FROM notification_outbox WHERE aggregate_id = $1
  `, [stored.id]);
  assert.ok(deliveryState.rows.every((item) => (
    item.status === "PENDING"
    && item.claimed_at === null
    && item.sent_at === null
    && item.failed_at === null
  )));
});

test("ADMIN-only reminders validate lifecycle/future time and are idempotent per appointment date", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await identity(repositories, "PATIENT", 30);
  const staff = await identity(repositories, "STAFF", 30);
  const admin = await identity(repositories, "ADMIN", 30);
  const service = await scheduledService(database, repositories);
  const appointment = await repositories.appointments.create({
    patientId: patient.patient.id,
    serviceId: service.id,
    appointmentDate,
    appointmentTime: "09:00",
    durationMinutes: 30,
    status: "CONFIRMED",
  });
  const url = `/api/admin/notifications/appointments/${appointment.id}/reminder`;

  assert.equal((await app.inject({ method: "POST", url })).statusCode, 401);
  assert.equal((await app.inject({
    method: "POST", url, headers: { cookie: staff.cookie },
  })).statusCode, 403);
  assert.equal((await app.inject({
    method: "POST", url, headers: { cookie: patient.cookie },
  })).statusCode, 403);

  const first = await app.inject({ method: "POST", url, headers: { cookie: admin.cookie } });
  const repeated = await app.inject({ method: "POST", url, headers: { cookie: admin.cookie } });
  assert.deepEqual(first.json(), {
    appointmentId: appointment.id, eventType: "APPOINTMENT_REMINDER", queued: true,
  });
  assert.deepEqual(repeated.json(), {
    appointmentId: appointment.id, eventType: "APPOINTMENT_REMINDER", queued: false,
  });

  const reminders = (await repositories.notifications.listByAggregate("appointment", appointment.id))
    .filter((item) => item.eventType === "APPOINTMENT_REMINDER");
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].recipientUserId, patient.user.id);
  const audits = await database.query(`
    SELECT count(*) AS total FROM audit_logs
    WHERE entity_id = $1 AND action = 'APPOINTMENT_REMINDER_QUEUE'
  `, [appointment.id]);
  assert.equal(Number(audits.rows[0].total), 1);

  await database.query("UPDATE appointments SET status = 'COMPLETED' WHERE id = $1", [appointment.id]);
  const terminal = await app.inject({ method: "POST", url, headers: { cookie: admin.cookie } });
  assert.equal(terminal.statusCode, 409);
  assert.equal(terminal.json().error.code, "APPOINTMENT_REMINDER_NOT_ALLOWED");
  assert.equal((await app.inject({
    method: "POST",
    url: "/api/admin/notifications/appointments/not-a-uuid/reminder",
    headers: { cookie: admin.cookie },
  })).statusCode, 400);
});
