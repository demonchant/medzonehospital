export function createQueueAppointmentReminderController(notifications) {
  return async function queueAppointmentReminderController(request) {
    return notifications.queueReminder(request.params.id, {
      userId: request.currentUser.id,
      ipAddress: request.ip,
    });
  };
}
