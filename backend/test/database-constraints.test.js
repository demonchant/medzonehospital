import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createTestDatabase } from "../test-utils/database.js";

async function fixtures(test) {
  const database = await createTestDatabase(test);
  await runMigrations(database, { useAdvisoryLock: false });
  const repositories = createRepositories(database);
  const user = await repositories.users.create({
    email: "patient@example.com",
    passwordHash: "phase-3-will-create-real-password-hashes",
  });
  const patient = await repositories.patients.create({
    userId: user.id,
    firstName: "Ada",
    lastName: "Okafor",
    phone: "+2348000000000",
    emergencyContact: { name: "Chidi", phone: "+2348111111111" },
  });
  const service = await repositories.services.create({
    name: "General Consultation",
    description: "General medical consultation",
    category: "General Medicine",
    durationMinutes: 30,
  });
  return { database, patient, repositories, service, user };
}

test("email uniqueness is case-insensitive", async (t) => {
  const { repositories } = await fixtures(t);
  await assert.rejects(
    repositories.users.create({
      email: "PATIENT@EXAMPLE.COM",
      passwordHash: "another-hash",
    }),
    /duplicate key value violates unique constraint/,
  );
});

test("patient and appointment foreign keys reject missing parents", async (t) => {
  const { repositories, service } = await fixtures(t);
  await assert.rejects(
    repositories.patients.create({
      userId: "00000000-0000-0000-0000-000000000000",
      firstName: "Missing",
      lastName: "User",
      phone: "+2348222222222",
    }),
    /violates foreign key constraint/,
  );
  await assert.rejects(
    repositories.appointments.create({
      patientId: "00000000-0000-0000-0000-000000000000",
      serviceId: service.id,
      appointmentDate: "2030-01-02",
      appointmentTime: "10:00",
      durationMinutes: 30,
    }),
    /violates foreign key constraint/,
  );
});

test("active appointment slots cannot be duplicated for a service", async (t) => {
  const { patient, repositories, service } = await fixtures(t);
  const slot = {
    patientId: patient.id,
    serviceId: service.id,
    appointmentDate: "2030-01-02",
    appointmentTime: "10:00",
    durationMinutes: 30,
  };
  await repositories.appointments.create(slot);

  await assert.rejects(
    repositories.appointments.create({ ...slot, status: "CONFIRMED" }),
    /duplicate key value violates unique constraint/,
  );
  const cancelled = await repositories.appointments.create({
    ...slot,
    status: "CANCELLED",
  });
  assert.equal(cancelled.status, "CANCELLED");
});

test("duration and structured JSON checks reject invalid records", async (t) => {
  const { database, repositories, user } = await fixtures(t);
  await assert.rejects(
    repositories.services.create({
      name: "Invalid Duration",
      description: "Invalid",
      category: "Test",
      durationMinutes: 0,
    }),
    /violates check constraint/,
  );
  await assert.rejects(
    database.query(`
      INSERT INTO patients (user_id, first_name, last_name, phone, emergency_contact)
      VALUES ($1, 'Bad', 'Contact', '123', '[]'::jsonb)
    `, [user.id]),
    /violates check constraint/,
  );
});

test("scheduling constraints reject invalid periods and appointment snapshots", async (t) => {
  const { database, patient, repositories, service } = await fixtures(t);
  await assert.rejects(
    database.query(`
      INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
      VALUES ($1, 7, '09:00', '10:00')
    `, [service.id]),
    /violates check constraint/,
  );
  await assert.rejects(
    database.query(`
      INSERT INTO service_blocked_periods (service_id, blocked_date, starts_at, ends_at)
      VALUES ($1, '2035-05-14', '10:00', NULL)
    `, [service.id]),
    /violates check constraint/,
  );
  await assert.rejects(
    repositories.appointments.create({
      patientId: patient.id,
      serviceId: service.id,
      appointmentDate: "2035-05-14",
      appointmentTime: "09:00",
      durationMinutes: 0,
    }),
    /violates check constraint/,
  );
});
