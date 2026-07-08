import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

// Unified Database connection pool
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const config = {
      host: process.env.DB_HOST || "db.dapzjynjobiroteovjke.supabase.co",
      port: parseInt(process.env.DB_PORT || "6543"),
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "XY2mhxeaxEIzp4Rw", // Fallback for immediate fix
      ssl: process.env.DB_SSL === "true" || true ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new pg.Pool(config);
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      process.exit(-1);
    });
  }
  return pool;
}
