const pool = require('../db');

async function initGamification() {
    try {
        console.log('🏗️ Starting Gamification Schema Migration...');

        // 1. Create Profiles Table
        console.log('👤 Creating profiles table...');
        await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        points INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // 2. Create Upvotes Table
        console.log('👍 Creating upvotes table...');
        await pool.query(`
      CREATE TABLE IF NOT EXISTS upvotes (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES profiles(id),
        report_id INTEGER REFERENCES reports(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, report_id)
      );
    `);

        // 3. Update Reports Table
        console.log('📊 Updating reports table...');
        await pool.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS user_id UUID;
    `);

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

initGamification();
