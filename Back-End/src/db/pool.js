import { Pool } from "pg";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  return url;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

