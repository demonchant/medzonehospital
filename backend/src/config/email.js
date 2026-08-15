import { z } from "zod";

const emailEnvironmentSchema = z.object({
  EMAIL_HOST: z.string().trim().min(1),
  EMAIL_PORT: z.coerce.number().int().min(1).max(65_535),
  EMAIL_USERNAME: z.string().trim().email(),
  EMAIL_PASSWORD: z.string().min(1),
});

export function loadEmailConfig(source = process.env) {
  const result = emailEnvironmentSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid email configuration: ${problems}`);
  }
  return Object.freeze({
    ...result.data,
    secure: result.data.EMAIL_PORT === 465,
  });
}
