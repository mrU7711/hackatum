const { Pool } = require("pg");

const pool = new Pool({
  // Using IP 18.202.64.2 (aws-1-eu-west-1.pooler.supabase.com) to bypass DNS issues
  connectionString: "postgresql://postgres.dbejkqpadeuagxauunfv:MyNewDbPassword123@18.202.64.2:5432/postgres",
  ssl: {
    rejectUnauthorized: false,
    servername: "aws-1-eu-west-1.pooler.supabase.com" // Required for SNI with IP connection
  },
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Increased to 5 seconds
});

// Handle pool errors gracefully - don't crash on idle connection errors
pool.on('error', (err, client) => {
  // Idle connection errors are normal with Supabase pooling
  if (err.code === 'XX000' && err.message && err.message.includes('db_termination')) {
    console.log('⚠️  Idle database connection closed (normal)');
  } else {
    console.error('⚠️  Database error:', err.message);
  }
  // Don't call process.exit() - let the pool handle reconnection
});

module.exports = pool;
