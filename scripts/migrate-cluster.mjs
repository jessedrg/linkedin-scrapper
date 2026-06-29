import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cluster text NOT NULL DEFAULT ''");
await client.end();
console.log("Migration OK — cluster column added");
