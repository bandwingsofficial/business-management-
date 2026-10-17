import pg from '../apps/api/node_modules/pg/lib/index.js';

const url = process.env['DATABASE_URL'];
if (url === undefined || url.length === 0) {
  process.stderr.write('DATABASE_URL is not set for the probe.\n');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 });
try {
  await client.connect();
  const result = await client.query('select current_database() as name');
  process.stdout.write(`verified database=${result.rows[0].name}\n`);
  await client.end();
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'error';
  process.stderr.write(
    `PostgreSQL connection failed (${code}). Check username, URL-encoded password, host, port, and that softtech_test exists.\n`,
  );
  process.exit(1);
}
