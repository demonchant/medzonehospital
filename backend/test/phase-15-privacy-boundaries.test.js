import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLoggerOptions } from "../src/config/logger.js";
import { runMigrations } from "../src/database/migrator.js";
import { renderNotificationEmail } from "../src/email/templates.js";
import { createRepositories } from "../src/repositories/index.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const clinicalFields = ["diagnosis", "labResults", "prescriptions", "medicalHistory", "clinicalNotes"];
let identitySequence = 0;

async function setup(testContext) {
  const database = await createTestDatabase(testContext, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(testContext, {
    AUTH_LOGIN_RATE_LIMIT_MAX: "100",
    AUTH_REGISTER_RATE_LIMIT_MAX: "100",
    CONTACT_RATE_LIMIT_MAX: "100",
  }, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function patientIdentity(app, label = "patient") {
  identitySequence += 1;
  const email = `${label}-${identitySequence}@example.test`;
  const password = "privacy boundary password";
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      firstName: "Privacy",
      lastName: `Patient${identitySequence}`,
      email,
      phone: `+2348000${String(identitySequence).padStart(6, "0")}`,
      password,
    },
  });
  assert.equal(registration.statusCode, 201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  assert.equal(login.statusCode, 200);
  return {
    cookie: login.headers["set-cookie"].split(";")[0],
    profileId: registration.json().profile.id,
    userId: registration.json().id,
  };
}

async function scheduledService(repositories, dateValue = "2035-07-02") {
  const service = await repositories.services.create({
    name: `Privacy Service ${randomUUID()}`,
    description: "Operational appointment service",
    category: "Consultation",
    durationMinutes: 30,
    status: "ACTIVE",
  });
  await repositories.schedules.createOperatingPeriod({
    serviceId: service.id,
    dayOfWeek: new Date(`${dateValue}T00:00:00Z`).getUTCDay(),
    opensAt: "09:00",
    closesAt: "12:00",
  });
  return service;
}

test("approved demographics remain available while every named clinical field is rejected", async (t) => {
  const { app } = await setup(t);
  const patient = await patientIdentity(app);
  const headers = { cookie: patient.cookie };
  const demographics = {
    dateOfBirth: "1990-05-10",
    gender: "Female",
    address: "10 Operational Road",
    emergencyContact: { name: "Emergency Contact", phone: "+2348111111111", relationship: "Sibling" },
  };
  const updated = await app.inject({ method: "PATCH", url: "/api/patients/me", headers, payload: demographics });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().dateOfBirth, demographics.dateOfBirth);
  assert.equal(updated.json().gender, demographics.gender);
  assert.equal(updated.json().address, demographics.address);
  assert.deepEqual(updated.json().emergencyContact, demographics.emergencyContact);
  const identity = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  assert.equal(identity.statusCode, 200);
  assert.equal("password" in identity.json(), false);
  assert.equal("passwordHash" in identity.json(), false);
  assert.equal("token" in identity.json(), false);

  for (const field of clinicalFields) {
    const profileResponse = await app.inject({
      method: "PATCH",
      url: "/api/patients/me",
      headers,
      payload: { [field]: "prohibited clinical value" },
    });
    assert.equal(profileResponse.statusCode, 400);
    assert.equal(profileResponse.json().error.code, "VALIDATION_ERROR");
    const appointmentResponse = await app.inject({
      method: "POST",
      url: "/api/appointments",
      headers,
      payload: {
        serviceId: randomUUID(),
        appointmentDate: "2035-07-02",
        appointmentTime: "09:00",
        [field]: "prohibited clinical value",
      },
    });
    assert.equal(appointmentResponse.statusCode, 400);
    assert.equal(appointmentResponse.json().error.code, "VALIDATION_ERROR");
    const contactResponse = await app.inject({
      method: "POST",
      url: "/api/contact",
      payload: {
        name: "Privacy Visitor",
        email: "visitor@example.test",
        subject: "Operational question",
        message: "Please confirm opening hours.",
        [field]: "prohibited clinical value",
      },
    });
    assert.equal(contactResponse.statusCode, 400);
    assert.equal(contactResponse.json().error.code, "VALIDATION_ERROR");
  }
});

test("operational free text persists but remains isolated from audits, notifications, and email", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await patientIdentity(app, "booking");
  const staff = await patientIdentity(app, "staff");
  const admin = await patientIdentity(app, "admin");
  await database.query("UPDATE users SET role = 'STAFF' WHERE id = $1", [staff.userId]);
  await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [admin.userId]);
  const service = await scheduledService(repositories);
  const notes = "Requires wheelchair access at reception";
  const booking = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: patient.cookie },
    payload: {
      serviceId: service.id,
      appointmentDate: "2035-07-02",
      appointmentTime: "09:00",
      notes,
    },
  });
  assert.equal(booking.statusCode, 201);
  assert.equal(booking.json().notes, notes);

  const appointmentAudit = await database.query(
    "SELECT metadata FROM audit_logs WHERE entity_id = $1",
    [booking.json().id],
  );
  const appointmentNotifications = await repositories.notifications.listByAggregate(
    "appointment",
    booking.json().id,
  );
  assert.equal(JSON.stringify(appointmentAudit.rows).includes(notes), false);
  assert.equal(JSON.stringify(appointmentNotifications).includes(notes), false);
  assert.equal(renderNotificationEmail(appointmentNotifications[0]).text.includes(notes), false);

  const message = "Please confirm wheelchair access at the main entrance.";
  const contact = await app.inject({
    method: "POST",
    url: "/api/contact",
    payload: { name: "Visitor", email: "visitor@example.test", subject: "Accessibility", message },
  });
  assert.equal(contact.statusCode, 201);
  assert.equal((await repositories.contactMessages.findById(contact.json().id)).message, message);
  const contactAudit = await database.query(
    "SELECT metadata FROM audit_logs WHERE entity_id = $1",
    [contact.json().id],
  );
  const contactNotifications = await repositories.notifications.listByAggregate(
    "contact_message",
    contact.json().id,
  );
  assert.equal(JSON.stringify(contactAudit.rows).includes(message), false);
  assert.equal(JSON.stringify(contactNotifications).includes(message), false);
  assert.equal(renderNotificationEmail(contactNotifications[0]).text.includes(message), false);
});

test("ownership, role authorization, and staff response minimization preserve the privacy boundary", async (t) => {
  const { app, database, repositories } = await setup(t);
  const owner = await patientIdentity(app, "owner");
  const other = await patientIdentity(app, "other");
  const operator = await patientIdentity(app, "operator");
  const privateMarker = "Private profile marker";
  await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: owner.cookie },
    payload: {
      dateOfBirth: "1985-03-02",
      gender: privateMarker,
      address: privateMarker,
      emergencyContact: { name: privateMarker, phone: "+2348222222222" },
    },
  });
  const service = await scheduledService(repositories);
  const appointment = await repositories.appointments.create({
    patientId: owner.profileId,
    serviceId: service.id,
    appointmentDate: "2035-07-02",
    appointmentTime: "09:00",
    durationMinutes: 30,
    notes: "Operational arrival note",
  });

  const otherDetails = await app.inject({
    method: "GET",
    url: `/api/appointments/${appointment.id}`,
    headers: { cookie: other.cookie },
  });
  assert.equal(otherDetails.statusCode, 404);
  assert.equal((await app.inject({
    method: "GET", url: "/api/staff/appointments", headers: { cookie: owner.cookie },
  })).statusCode, 403);

  await database.query("UPDATE users SET role = 'STAFF' WHERE id = $1", [operator.userId]);
  const staffList = await app.inject({
    method: "GET",
    url: "/api/staff/appointments?pageSize=100",
    headers: { cookie: operator.cookie },
  });
  assert.equal(staffList.statusCode, 200);
  assert.equal(JSON.stringify(staffList.json()).includes(privateMarker), false);
  assert.deepEqual(
    Object.keys(staffList.json().items[0].patient).sort(),
    ["email", "firstName", "id", "lastName", "phone"],
  );
  assert.equal((await app.inject({
    method: "GET",
    url: `/api/services/${service.id}/schedule`,
    headers: { cookie: operator.cookie },
  })).statusCode, 403);

  await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [operator.userId]);
  assert.equal((await app.inject({
    method: "GET",
    url: `/api/services/${service.id}/schedule`,
    headers: { cookie: operator.cookie },
  })).statusCode, 200);
});

test("persistence allowlists and logger redaction reject clinical or sensitive spillover", async (t) => {
  const { database, repositories } = await setup(t);
  const serviceId = randomUUID();
  const appointmentId = randomUUID();
  const basePayload = {
    appointmentId,
    serviceId,
    serviceName: "General Consultation",
    appointmentDate: "2035-07-02",
    appointmentTime: "09:00",
  };

  for (const field of [...clinicalFields, "notes", "message"]) {
    await assert.rejects(
      repositories.auditLogs.appendOperational({
        action: "APPOINTMENT_CREATE",
        entity: "appointment",
        entityId: appointmentId,
        metadata: { serviceId, [field]: "not approved" },
      }),
      /violates its approved operational shape/,
    );
    await assert.rejects(
      repositories.notifications.enqueue({
        eventKey: `privacy:${field}:${randomUUID()}`,
        eventType: "APPOINTMENT_REQUESTED",
        audience: "PATIENT",
        recipientUserId: null,
        recipientEmail: "patient@example.test",
        aggregateType: "appointment",
        aggregateId: appointmentId,
        payload: { ...basePayload, [field]: "not approved" },
      }),
      /violates its approved operational shape/,
    );
  }
  assert.equal(Number((await database.query("SELECT count(*) AS total FROM audit_logs")).rows[0].total), 0);
  assert.equal(Number((await database.query("SELECT count(*) AS total FROM notification_outbox")).rows[0].total), 0);

  const paths = createLoggerOptions({ LOG_LEVEL: "info" }).redact.paths;
  for (const path of [
    "req.body.password",
    "req.body.notes",
    "req.body.message",
    "req.body.address",
    "req.body.emergencyContact",
  ]) assert.ok(paths.includes(path));
});
