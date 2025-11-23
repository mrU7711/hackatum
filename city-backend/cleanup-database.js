const pool = require('./db');

async function cleanDatabase() {
    console.log('🧹 Cleaning database...');

    try {
        // Delete in correct order (foreign keys)
        await pool.query('DELETE FROM volunteers');
        console.log('✅ Deleted volunteers');

        await pool.query('DELETE FROM upvotes');
        console.log('✅ Deleted upvotes');

        await pool.query('DELETE FROM report_duplicates');
        console.log('✅ Deleted report_duplicates');

        await pool.query('DELETE FROM reports');
        console.log('✅ Deleted reports');

        await pool.query('DELETE FROM profiles');
        console.log('✅ Deleted profiles');

        console.log('\n🎉 Database cleaned successfully!');
        console.log('Ready for fresh demo data.\n');
    } catch (error) {
        console.error('❌ Error cleaning database:', error.message);
    } finally {
        await pool.end();
    }
}

cleanDatabase();
