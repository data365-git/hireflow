import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Count before
    const before = await client.query(`
      SELECT 'vacancies' as tbl, count(*)::int as total, count(*) filter (where is_demo = false)::int as real_rows FROM vacancies
      UNION ALL
      SELECT 'candidates', count(*)::int, count(*) filter (where is_demo = false)::int FROM candidates
    `);
    console.log("Before re-tag:");
    before.rows.forEach(r => console.log(`  ${r.tbl}: ${r.total} total, ${r.real_rows} marked real`));

    // Re-tag
    const v = await client.query("UPDATE vacancies SET is_demo = true WHERE is_demo = false");
    const c = await client.query("UPDATE candidates SET is_demo = true WHERE is_demo = false");
    console.log(`\nUpdated: ${v.rowCount} vacancies, ${c.rowCount} candidates`);

    // Verify — both must be zero
    const after = await client.query(`
      SELECT 'vacancies_real' as check, count(*)::int as remaining FROM vacancies WHERE is_demo = false
      UNION ALL
      SELECT 'candidates_real', count(*)::int FROM candidates WHERE is_demo = false
    `);
    const nonZero = after.rows.filter(r => r.remaining > 0);
    if (nonZero.length > 0) {
      throw new Error(`Re-tag incomplete: ${JSON.stringify(nonZero)}`);
    }
    console.log("\nDiagnostic: all real rows cleared ✓");

    await client.query("COMMIT");
    console.log("Transaction committed.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ROLLED BACK:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
