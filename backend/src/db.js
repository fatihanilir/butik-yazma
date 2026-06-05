import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

function sslConfig(connectionString) {
  if (!connectionString) return undefined;
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}

if (!config.dbUrl) {
  console.warn("DATABASE_URL is not set. API will fail until configured.");
}

export const pool = new Pool({
  connectionString: config.dbUrl || undefined,
  ssl: sslConfig(config.dbUrl),
});

export const query = (text, params = []) => pool.query(text, params);
