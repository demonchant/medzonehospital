import cors from "@fastify/cors";

export async function registerCors(app, config) {
  const allowedOrigins = new Set(config.corsOrigins);

  await app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "OPTIONS", "POST", "PATCH", "DELETE"],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });
}
