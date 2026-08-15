import pg from "pg";

const { Pool } = pg;

export function createDatabase(config, logger) {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create a database connection");
  }

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    max: config.DATABASE_POOL_MAX,
    min: config.DATABASE_POOL_MIN,
    ssl: config.DATABASE_SSL
      ? { rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED }
      : false,
  });

  pool.on("error", (error) => {
    logger?.error({ err: error }, "Unexpected idle PostgreSQL client error");
  });

  return {
    async query(text, parameters = []) {
      return pool.query(text, parameters);
    },

    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async checkConnection() {
      const result = await pool.query("SELECT 1 AS connected");
      return result.rows[0]?.connected === 1;
    },

    async close() {
      await pool.end();
    },
  };
}
