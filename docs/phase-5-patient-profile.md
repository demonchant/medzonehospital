# Phase 5 — Patient Profile

Phase 5 adds authenticated self-service access to the existing `patients` records. It does not add staff patient search, appointments, scheduling, doctor selection, notifications, clinical records, or frontend integration.

## Endpoints and access

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/patients/me` | PATIENT | Retrieve the authenticated patient's profile |
| PATCH | `/api/patients/me` | PATIENT | Partially update or complete the authenticated patient's profile |

The user ID comes exclusively from the validated Phase 3 session. There is no public or patient-facing `/api/patients/:id` route, and profile bodies cannot contain an `id` or `userId`. This prevents a patient from selecting another patient's record by changing a URL or request field.

`STAFF` and `ADMIN` are denied these self-service routes. Their later operational patient-search access belongs to the admin/staff phase and will require purpose-specific endpoints rather than broadening the patient endpoint.

## Profile creation and completion

Patient registration already creates `users` and `patients` together in one transaction, so Phase 5 does not add a duplicate profile-creation endpoint. Optional fields start as `NULL` and can be completed with `PATCH /api/patients/me`.

## Supported fields

- `firstName`: required identity field, non-blank, maximum 100 characters
- `lastName`: required identity field, non-blank, maximum 100 characters
- `phone`: required operational contact field, non-blank, 3–30 characters
- `dateOfBirth`: optional ISO calendar date, never future-dated
- `gender`: optional, non-blank when present, maximum 50 characters
- `address`: optional, non-blank when present, maximum 5,000 characters
- `emergencyContact`: optional structured object with required `name` and `phone`, plus optional `relationship`

Optional fields accept `null` so patients can clear them. Text is trimmed server-side. Unknown fields are rejected, including clinical fields such as diagnoses or medical history.

## Persistence and audit behavior

No migration was required because the Phase 2 one-to-one patient table already contains every approved field and the managed `updated_at` trigger. Updates use parameterized SQL and preserve omitted fields, including the distinction between omission and explicit `null`.

Registration remains covered by `AUTH_REGISTER`. Each successful profile update adds `PATIENT_PROFILE_UPDATE`, identifies the patient entity and authenticated user, and records only the names of changed fields—not their potentially sensitive values.

## Deliberate boundaries

- No patient listing, search, or lookup by arbitrary ID
- No staff/admin patient-management API
- No email/password changes; those belong to identity/account workflows
- No diagnoses, prescriptions, medical history, lab results, or clinical notes
- No appointments or service scheduling
- No frontend integration or UI changes
