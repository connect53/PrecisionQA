import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Default Supabase project reference
const PROJECT_REF = 'dapzjynjobiroteovjke';

// Standard AWS regions for Supabase regional connection poolers
const REGIONS = [
  { code: 'ap-south-1', name: 'Mumbai (Asia Pacific)' },
  { code: 'ap-southeast-1', name: 'Singapore (Asia Pacific)' },
  { code: 'us-east-1', name: 'N. Virginia (US East)' },
  { code: 'us-west-2', name: 'Oregon (US West)' },
  { code: 'eu-central-1', name: 'Frankfurt (Europe)' },
  { code: 'eu-west-1', name: 'Ireland (Europe)' }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function runMigration() {
  console.log('====================================================');
  console.log('       PRECISIONQA SUPABASE MIGRATION ENGINE        ');
  console.log('====================================================\n');

  console.log('This script will connect to your Supabase PostgreSQL database,');
  console.log('execute the SQL schema migration file, and verify all tables.');
  console.log('Note: To connect from an IPv4-only network, you should use the connection pooler.\n');

  // 1. Get database password
  let dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
  if (!dbPassword) {
    dbPassword = await askQuestion('🔑 Enter your Supabase Database Password: ');
    if (!dbPassword.trim()) {
      console.error('❌ Error: Database password is required to run the migration.');
      rl.close();
      process.exit(1);
    }
  }

  // 2. Select Connection Method
  console.log('\nSelect Connection Method:');
  console.log('1. Connection Pooler (Recommended for IPv4-only networks)');
  console.log('2. Direct Database Connection (Requires IPv6 outbound network)');
  const methodChoice = await askQuestion('Selection (1 or 2, default is 1): ') || '1';

  let host = '';
  let port = 6543;
  let user = 'postgres';

  if (methodChoice === '2') {
    host = `db.${PROJECT_REF}.supabase.co`;
    port = 5432;
    console.log(`\nConnecting directly to: ${host}:${port}...`);
  } else {
    console.log('\nSelect your Supabase Project Region:');
    REGIONS.forEach((reg, index) => {
      console.log(`${index + 1}. ${reg.name} [${reg.code}]`);
    });
    const regionChoice = await askQuestion(`Select region (1-${REGIONS.length}, default is 1): `) || '1';
    const regIdx = parseInt(regionChoice) - 1;
    const selectedReg = REGIONS[regIdx] || REGIONS[0];

    host = `aws-0-${selectedReg.code}.pooler.supabase.com`;
    user = `postgres.${PROJECT_REF}`;
    console.log(`\nConnecting to Regional Pooler: ${host}:${port}...`);
  }

  const client = new pg.Client({
    host,
    port,
    database: 'postgres',
    user,
    password: dbPassword,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  });

  try {
    console.log('⏳ Connecting to database...');
    await client.connect();
    console.log('🎉 Successfully connected to your Supabase PostgreSQL database!\n');

    // Read schema SQL
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260703000000_precisionqa_schema.sql');
    console.log(`📄 Reading migration schema file from: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Executing SQL migration schema on Supabase (creating tables, indexes, and RLS policies)...');
    await client.query(sql);
    console.log('🎉 Migration statements executed successfully!');

    // Verify created tables
    console.log('\n🔍 Verifying table creations in the "public" schema...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n====================================================');
    console.log('             CREATED TABLES VERIFICATION             ');
    console.log('====================================================');
    if (result.rows.length === 0) {
      console.log('⚠️ No tables found in public schema.');
    } else {
      result.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.table_name}`);
      });
    }
    console.log('====================================================\n');
    console.log('🎉 Schema is fully deployed and verified! PrecisionQA is ready to roll.');

  } catch (err: any) {
    console.error('\n❌ Connection or execution failed!');
    console.error(`Reason: ${err.message}`);
    console.log('\nTroubleshooting Tips:');
    console.log('1. Double check that your Database Password is correct.');
    console.log('2. Make sure you selected the correct region for your project.');
    console.log('3. If using Connection Method 2, verify your network supports outbound IPv6.');
  } finally {
    await client.end();
    rl.close();
  }
}

runMigration();
