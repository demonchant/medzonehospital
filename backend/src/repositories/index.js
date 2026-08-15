import { AppointmentsRepository } from "./appointments.repository.js";
import { AuditLogsRepository } from "./audit-logs.repository.js";
import { ContactMessagesRepository } from "./contact-messages.repository.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { PatientsRepository } from "./patients.repository.js";
import { SchedulesRepository } from "./schedules.repository.js";
import { ServicesRepository } from "./services.repository.js";
import { SessionsRepository } from "./sessions.repository.js";
import { UsersRepository } from "./users.repository.js";

export function createRepositories(database) {
  return Object.freeze({
    appointments: new AppointmentsRepository(database),
    auditLogs: new AuditLogsRepository(database),
    contactMessages: new ContactMessagesRepository(database),
    notifications: new NotificationsRepository(database),
    patients: new PatientsRepository(database),
    schedules: new SchedulesRepository(database),
    services: new ServicesRepository(database),
    sessions: new SessionsRepository(database),
    users: new UsersRepository(database),
  });
}
