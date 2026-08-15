CREATE TYPE user_role AS ENUM ('PATIENT', 'STAFF', 'ADMIN');
CREATE TYPE user_account_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE service_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE contact_message_status AS ENUM ('UNREAD', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PATIENT',
  status user_account_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 3),
  CONSTRAINT users_password_hash_not_blank CHECK (length(password_hash) > 0)
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CREATE INDEX users_role_status_idx ON users (role, status);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(50),
  address TEXT,
  emergency_contact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT patients_first_name_not_blank CHECK (length(btrim(first_name)) > 0),
  CONSTRAINT patients_last_name_not_blank CHECK (length(btrim(last_name)) > 0),
  CONSTRAINT patients_phone_not_blank CHECK (length(btrim(phone)) > 0),
  CONSTRAINT patients_emergency_contact_object CHECK (
    emergency_contact IS NULL OR jsonb_typeof(emergency_contact) = 'object'
  )
);

CREATE INDEX patients_name_idx ON patients (lower(last_name), lower(first_name));
CREATE INDEX patients_phone_idx ON patients (phone);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status service_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT services_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT services_category_not_blank CHECK (length(btrim(category)) > 0),
  CONSTRAINT services_duration_valid CHECK (duration_minutes BETWEEN 5 AND 1440)
);

CREATE UNIQUE INDEX services_name_lower_unique ON services (lower(name));
CREATE INDEX services_status_category_idx ON services (status, category);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  appointment_time TIME WITHOUT TIME ZONE NOT NULL,
  status appointment_status NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX appointments_active_slot_unique
  ON appointments (service_id, appointment_date, appointment_time)
  WHERE status IN ('PENDING'::appointment_status, 'CONFIRMED'::appointment_status);
CREATE INDEX appointments_patient_date_idx ON appointments (patient_id, appointment_date DESC, appointment_time DESC);
CREATE INDEX appointments_service_date_status_idx ON appointments (service_id, appointment_date, status);
CREATE INDEX appointments_status_date_idx ON appointments (status, appointment_date, appointment_time);

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(30),
  subject VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  status contact_message_status NOT NULL DEFAULT 'UNREAD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT contact_messages_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT contact_messages_email_not_blank CHECK (length(btrim(email)) > 3),
  CONSTRAINT contact_messages_subject_not_blank CHECK (length(btrim(subject)) > 0),
  CONSTRAINT contact_messages_message_not_blank CHECK (length(btrim(message)) > 0)
);

CREATE INDEX contact_messages_status_created_idx ON contact_messages (status, created_at DESC);
CREATE INDEX contact_messages_email_idx ON contact_messages (lower(email));

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_action_not_blank CHECK (length(btrim(action)) > 0),
  CONSTRAINT audit_logs_entity_not_blank CHECK (length(btrim(entity)) > 0),
  CONSTRAINT audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_logs_user_created_idx ON audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_entity_created_idx ON audit_logs (entity, entity_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contact_messages_set_updated_at
  BEFORE UPDATE ON contact_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
