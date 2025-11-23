const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres.dbejkqpadeuagxauunfv:MyNewDbPassword123@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false },
});

async function checkSchema() {
    try {
        console.log("Checking reports table schema...");
        const res = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'reports' AND column_name = 'id';
    `);
        console.log("Reports ID type:", res.rows);

        console.log("Checking upvotes table schema if exists...");
        const res2 = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'upvotes';
    `);
        console.log("Upvotes schema:", res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSchema();
