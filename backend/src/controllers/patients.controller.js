export function createGetOwnPatientProfileController(patientProfiles) {
  return async function getOwnPatientProfileController(request) {
    return patientProfiles.getOwn(request.currentUser.id);
  };
}

export function createUpdateOwnPatientProfileController(patientProfiles) {
  return async function updateOwnPatientProfileController(request) {
    return patientProfiles.updateOwn(request.currentUser.id, request.body, {
      ipAddress: request.ip,
    });
  };
}
