import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createTestDatabase } from "../test-utils/database.js";

test("repositories persist and retrieve every Phase 2 entity", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database, { useAdvisoryLock: false });
  const repositories = createRepositories(database);

  const user = await repositories.users.create({
    email: "records@example.com",
    passwordHash: "pre-hashed-value-only",
  });
  assert.equal((await repositories.users.findByEmail("RECORDS@example.com")).id, user.id);

  const patient = await repositories.patients.create({
    userId: user.id,
    firstName: "Musa",
    lastName: "Bello",
    phone: "+2348333333333",
  });
  assert.equal((await repositories.patients.findByUserId(user.id)).id, patient.id);

  const service = await repositories.services.create({
    name: "Laboratory",
    description: "Diagnostic laboratory service",
    category: "Diagnostics",
    durationMinutes: 30,
  });
  assert.deepEqual((await repositories.services.listActive()).map((item) => item.id), [service.id]);

  const appointment = await repositories.appointments.create({
    patientId: patient.id,
    serviceId: service.id,
    appointmentDate: "2030-02-03",
    appointmentTime: "11:30",
    durationMinutes: 30,
    notes: "Operational note only",
  });
  assert.equal((await repositories.appointments.findById(appointment.id)).serviceId, service.id);

  const message = await repositories.contactMessages.create({
    name: "Visitor",
    email: "VISITOR@example.com",
    subject: "Opening hours",
    message: "Please confirm your opening hours.",
  });
  assert.equal((await repositories.contactMessages.findById(message.id)).email, "visitor@example.com");

  const audit = await repositories.auditLogs.append({
    userId: user.id,
    action: "CREATE",
    entity: "appointment",
    entityId: appointment.id,
    metadata: { source: "repository-test" },
    ipAddress: "127.0.0.1",
  });
  assert.equal((await repositories.auditLogs.findByEntity("appointment", appointment.id))[0].id, audit.id);
});

test("updated_at triggers are database-managed", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database, { useAdvisoryLock: false });
  const repositories = createRepositories(database);
  const service = await repositories.services.create({
    name: "Radiology",
    description: "Imaging",
    category: "Diagnostics",
    durationMinutes: 45,
  });

  await database.query(
    "UPDATE services SET updated_at = '2000-01-01', description = 'Updated imaging' WHERE id = $1",
    [service.id],
  );
  const updated = await repositories.services.findById(service.id);
  assert.ok(new Date(updated.updatedAt) > new Date("2020-01-01"));
});
