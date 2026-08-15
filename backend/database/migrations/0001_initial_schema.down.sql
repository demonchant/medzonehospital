DROP TRIGGER IF EXISTS contact_messages_set_updated_at ON contact_messages;
DROP TRIGGER IF EXISTS appointments_set_updated_at ON appointments;
DROP TRIGGER IF EXISTS services_set_updated_at ON services;
DROP TRIGGER IF EXISTS patients_set_updated_at ON patients;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS contact_message_status;
DROP TYPE IF EXISTS appointment_status;
DROP TYPE IF EXISTS service_status;
DROP TYPE IF EXISTS user_account_status;
DROP TYPE IF EXISTS user_role;
