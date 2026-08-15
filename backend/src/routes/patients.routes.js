import {
  createGetOwnPatientProfileController,
  createUpdateOwnPatientProfileController,
} from "../controllers/patients.controller.js";
import {
  getOwnPatientProfileRouteSchema,
  updateOwnPatientProfileRouteSchema,
} from "../validators/patients.schemas.js";

export async function patientsRoutes(app, { patientProfiles }) {
  const patientOnly = [app.authenticate, app.authorizeRoles("PATIENT")];

  app.get("/me", {
    preHandler: patientOnly,
    schema: getOwnPatientProfileRouteSchema,
    handler: createGetOwnPatientProfileController(patientProfiles),
  });

  app.patch("/me", {
    preHandler: patientOnly,
    schema: updateOwnPatientProfileRouteSchema,
    handler: createUpdateOwnPatientProfileController(patientProfiles),
  });
}
