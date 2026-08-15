import { createRepositories } from "../repositories/index.js";
import { renderNotificationEmail } from "./templates.js";

function failureReason(error) {
  const candidate = typeof error?.code === "string" ? error.code : "DELIVERY_ERROR";
  return /^[A-Z0-9_]{1,100}$/.test(candidate) ? candidate : "DELIVERY_ERROR";
}

export function createEmailProcessor({ database, logger, transport }) {
  const repositories = createRepositories(database);

  return Object.freeze({
    async processBatch(limit = 25) {
      const notifications = await repositories.notifications.claimPending(limit);
      let failed = 0;
      let sent = 0;
      for (const notification of notifications) {
        try {
          const rendered = renderNotificationEmail(notification);
          await transport.send({
            to: notification.recipientEmail,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
          });
          await repositories.notifications.markSent(notification.id);
          sent += 1;
        } catch (error) {
          const reason = failureReason(error);
          await repositories.notifications.markFailed(notification.id, reason);
          logger?.warn?.({ notificationId: notification.id, errorCode: reason }, "Email delivery failed");
          failed += 1;
        }
      }
      return { claimed: notifications.length, failed, sent };
    },
  });
}
