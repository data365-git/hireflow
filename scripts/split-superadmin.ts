import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create superadmin system role if it doesn't exist
    await client.query(`
      INSERT INTO system_roles (id, name, display_name, color, is_system, is_superadmin)
      SELECT gen_random_uuid()::text, 'superadmin', 'Superadmin', '#7c3aed', true, true
      WHERE NOT EXISTS (SELECT 1 FROM system_roles WHERE name = 'superadmin');
    `);
    console.log("Step 1: superadmin role created (or already existed)");

    // 2. Demote admin role — remove superadmin flag
    const demoteResult = await client.query(`
      UPDATE system_roles SET is_superadmin = false WHERE name = 'admin';
    `);
    console.log(`Step 2: admin role demoted (${demoteResult.rowCount} row updated)`);

    // 3. Assign superadmin role to admin@data365.io if not already assigned
    const assignResult = await client.query(`
      INSERT INTO user_roles (id, user_id, role, is_active)
      SELECT gen_random_uuid()::text, u.id, 'superadmin', true
      FROM users u
      WHERE u.email = 'admin@data365.io'
        AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'superadmin'
        );
    `);
    console.log(`Step 3: superadmin assigned to admin@data365.io (${assignResult.rowCount} row inserted)`);

    await client.query("COMMIT");
    console.log("\nTransaction committed.\n");

    // 4. Diagnostic query
    const diag = await client.query(`
      SELECT u.email, ur.role, sr.is_superadmin
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN system_roles sr ON sr.name = ur.role
      ORDER BY u.email, ur.role;
    `);

    console.log("Diagnostic — user roles and superadmin flags:");
    console.table(diag.rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error — transaction rolled back:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
