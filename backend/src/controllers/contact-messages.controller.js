function requestContext(request) {
  return { ipAddress: request.ip };
}

function actor(request) {
  return { userId: request.currentUser.id, ipAddress: request.ip };
}

export function createSubmitContactMessageController(contactMessages) {
  return async function submitContactMessageController(request, reply) {
    const receipt = await contactMessages.submit(request.body, requestContext(request));
    return reply.code(201).send(receipt);
  };
}

export function createListContactMessagesController(contactMessages) {
  return async function listContactMessagesController(request) {
    return contactMessages.list(request.query);
  };
}

export function createContactMessageDetailsController(contactMessages) {
  return async function contactMessageDetailsController(request) {
    return contactMessages.details(request.params.id);
  };
}

export function createTransitionContactMessageController(contactMessages) {
  return async function transitionContactMessageController(request) {
    return contactMessages.transition(request.params.id, request.body.status, actor(request));
  };
}
