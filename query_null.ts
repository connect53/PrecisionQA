import { getPool } from "./src/lib/db";
async function main() {
  const pool = getPool();
  const res = await pool.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'agent_id'`);
  console.log(res.rows);
  process.exit(0);
}
main();
