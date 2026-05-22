import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __dirname = new URL('.', import.meta.url).pathname;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

console.log('Applying migrations...');
try {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('✓ Migrations applied successfully');
} catch (e) {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
}

console.log('Seeding question templates...');
try {
  const exec = (await import('child_process')).execSync;
  exec('npm run db:seed-question-templates', { stdio: 'inherit' });
  console.log('✓ Seed completed');
} catch (e) {
  console.error('✗ Seed failed:', e.message);
  process.exit(1);
}

await sql.end();
console.log('Done!');
