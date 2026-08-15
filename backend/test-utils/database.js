import { PGlite } from "@electric-sql/pglite";

function adaptPGlite(client) {
  return {
    async query(text, parameters = []) {
      if (parameters.length > 0) return client.query(text, parameters);
      const results = await client.exec(text);
      return results.at(-1) ?? { affectedRows: 0, fields: [], rows: [] };
    },

    async transaction(work) {
      return client.transaction((transaction) => work(adaptPGlite(transaction)));
    },
  };
}

export async function createTestDatabase(test, options = {}) {
  const pglite = new PGlite();
  await pglite.waitReady;
  const database = adaptPGlite(pglite);
  database.checkConnection = async () => {
    const result = await pglite.query("SELECT 1 AS connected");
    return result.rows[0]?.connected === 1;
  };
  database.close = () => pglite.close();
  if (options.autoClose !== false) test.after(() => database.close());
  return database;
}
