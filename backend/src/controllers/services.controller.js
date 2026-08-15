function mutationContext(request) {
  return {
    ipAddress: request.ip,
    userId: request.currentUser.id,
  };
}

export function createListServicesController(serviceCatalog) {
  return async function listServicesController() {
    return serviceCatalog.listActive();
  };
}

export function createServiceDetailsController(serviceCatalog) {
  return async function serviceDetailsController(request) {
    return serviceCatalog.getActiveById(request.params.id);
  };
}

export function createCreateServiceController(serviceCatalog) {
  return async function createServiceController(request, reply) {
    const service = await serviceCatalog.create(request.body, mutationContext(request));
    return reply.code(201).send(service);
  };
}

export function createUpdateServiceController(serviceCatalog) {
  return async function updateServiceController(request) {
    return serviceCatalog.update(request.params.id, request.body, mutationContext(request));
  };
}

export function createDeactivateServiceController(serviceCatalog) {
  return async function deactivateServiceController(request, reply) {
    await serviceCatalog.deactivate(request.params.id, mutationContext(request));
    return reply.code(204).send();
  };
}
