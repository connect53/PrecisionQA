import { getPool } from "./src/lib/db";
async function main() {
  const pool = getPool();
  const res = await pool.query(`SELECT id FROM public.users LIMIT 5`);
  console.log(res.rows);
  process.exit(0);
}
main();
