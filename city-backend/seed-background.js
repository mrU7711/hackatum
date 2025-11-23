const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

// 10 realistic Munich citizens with diverse backgrounds
const BACKGROUND_USERS = [
    { email: 'stefan.mueller@munich.de', name: 'Stefan Müller', points: 45 },
    { email: 'lisa.schmidt@gmail.com', name: 'Lisa Schmidt', points: 38 },
    { email: 'michael.weber@outlook.com', name: 'Michael Weber', points: 32 },
    { email: 'sarah.fischer@yahoo.de', name: 'Sarah Fischer', points: 28 },
    { email: 'thomas.becker@web.de', name: 'Thomas Becker', points: 25 },
    { email: 'julia.hoffmann@gmx.de', name: 'Julia Hoffmann', points: 22 },
    { email: 'markus.schulz@icloud.com', name: 'Markus Schulz', points: 18 },
    { email: 'anna.wagner@t-online.de', name: 'Anna Wagner', points: 15 },
    { email: 'peter.klein@freenet.de', name: 'Peter Klein', points: 12 },
    { email: 'maria.wolf@mail.de', name: 'Maria Wolf', points: 10 }
];

// 20 realistic reports spread across Munich + TUM Garching
const BACKGROUND_REPORTS = [
    // TUM GARCHING CAMPUS (5 reports - for nearby demo)
    { desc: 'Broken bike rack near Informatik building. Cannot lock bikes properly.', lat: 48.2625, lon: 11.6681, cat: 'infrastructure', sev: 'medium', userIdx: 0 },
    { desc: 'Streetlight not working on path to Maschinenwesen. Very dark at night.', lat: 48.2635, lon: 11.6695, cat: 'infrastructure', sev: 'high', userIdx: 1 },
    { desc: 'Overflowing trash bins at Mensa cafeteria entrance.', lat: 48.2642, lon: 11.6708, cat: 'environment', sev: 'low', userIdx: 2 },
    { desc: 'Slippery floor in Mathematics building entrance when raining. Safety hazard.', lat: 48.2618, lon: 11.6672, cat: 'safety', sev: 'medium', userIdx: 3 },
    { desc: 'Broken water fountain in Chemistry building. Students need water access.', lat: 48.2651, lon: 11.6715, cat: 'infrastructure', sev: 'low', userIdx: 4 },

    // Marienplatz area
    { desc: 'Broken pavement near Marienplatz U-Bahn entrance. Tripping hazard.', lat: 48.1371, lon: 11.5754, cat: 'infrastructure', sev: 'medium', userIdx: 5 },
    { desc: 'Overflowing trash bin at Viktualienmarkt. Attracting rats.', lat: 48.1351, lon: 11.5762, cat: 'environment', sev: 'low', userIdx: 6 },

    // Schwabing
    { desc: 'Graffiti on historic building facade on Leopoldstraße.', lat: 48.1638, lon: 11.5812, cat: 'environment', sev: 'low', userIdx: 7 },
    { desc: 'Broken street sign at Münchner Freiheit intersection.', lat: 48.1621, lon: 11.5875, cat: 'infrastructure', sev: 'medium', userIdx: 8 },

    // Sendling
    { desc: 'Pothole on Lindwurmstraße causing damage to cars.', lat: 48.1245, lon: 11.5589, cat: 'infrastructure', sev: 'high', userIdx: 9 },
    { desc: 'Homeless person needs assistance near Sendlinger Tor.', lat: 48.1328, lon: 11.5667, cat: 'social', sev: 'medium', userIdx: 0 },

    // Hauptbahnhof area
    { desc: 'Broken escalator at Hauptbahnhof, people struggling with luggage.', lat: 48.1405, lon: 11.5580, cat: 'infrastructure', sev: 'high', userIdx: 1 },
    { desc: 'Illegal parking blocking bike lane on Bayerstraße.', lat: 48.1412, lon: 11.5543, cat: 'safety', sev: 'medium', userIdx: 2 },

    // Englischer Garten
    { desc: 'Fallen tree branch blocking jogging path in English Garden.', lat: 48.1645, lon: 11.6048, cat: 'environment', sev: 'low', userIdx: 3 },
    { desc: 'Broken water fountain, children disappointed.', lat: 48.1598, lon: 11.6012, cat: 'infrastructure', sev: 'low', userIdx: 4 },

    // Olympiapark
    { desc: 'Damaged fence near Olympic Stadium, safety concern.', lat: 48.1738, lon: 11.5462, cat: 'safety', sev: 'medium', userIdx: 5 },

    // Giesing
    { desc: 'Streetlight not working on Tegernseer Landstraße. Very dark.', lat: 48.1089, lon: 11.5923, cat: 'infrastructure', sev: 'high', userIdx: 6 },

    // Neuhausen
    { desc: 'Playground equipment broken at Rotkreuzplatz park.', lat: 48.1512, lon: 11.5345, cat: 'infrastructure', sev: 'medium', userIdx: 7 },

    // Haidhausen
    { desc: 'Bike lane markings completely faded on Rosenheimer Straße.', lat: 48.1289, lon: 11.5945, cat: 'safety', sev: 'medium', userIdx: 8 },

    // Laim
    { desc: 'Bus stop shelter damaged, no protection from rain.', lat: 48.1423, lon: 11.5012, cat: 'infrastructure', sev: 'low', userIdx: 9 }
];

async function seedBackgroundData() {
    console.log('🌱 Seeding background data...\n');

    try {
        // Create user profiles with generated UUIDs
        const userIds = [];
        console.log('Creating 10 background users...');

        for (const user of BACKGROUND_USERS) {
            const userId = uuidv4();
            userIds.push(userId);

            await pool.query(
                'INSERT INTO profiles (id, email, full_name, points, created_at) VALUES ($1, $2, $3, $4, NOW())',
                [userId, user.email, user.name, user.points]
            );
            console.log(`✅ ${user.name} (${user.points} points)`);
        }

        console.log('\nCreating 20 background reports (5 at TUM Garching)...');

        // Create reports
        for (const report of BACKGROUND_REPORTS) {
            const userId = userIds[report.userIdx];

            await pool.query(`
                INSERT INTO reports 
                (description, photo_url, lat, lon, category, severity, is_spam, ai_confidence, user_id, upvote_count, status, analyzed_at, created_at)
                VALUES ($1, NULL, $2, $3, $4, $5, false, $6, $7, $8, 'pending', NOW(), NOW())
            `, [
                report.desc,
                report.lat,
                report.lon,
                report.cat,
                report.sev,
                0.85 + Math.random() * 0.1, // Random confidence 0.85-0.95
                userId,
                Math.floor(Math.random() * 3) // Random 0-2 upvotes
            ]);
            console.log(`✅ ${report.desc.substring(0, 50)}...`);
        }

        // Add some random upvotes for realism
        console.log('\nAdding random upvotes...');
        const reports = await pool.query('SELECT id FROM reports LIMIT 10');

        for (let i = 0; i < 8; i++) {
            const randomReport = reports.rows[Math.floor(Math.random() * reports.rows.length)];
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];

            try {
                await pool.query(
                    'INSERT INTO upvotes (user_id, report_id, created_at) VALUES ($1, $2, NOW())',
                    [randomUser, randomReport.id]
                );

                await pool.query(
                    'UPDATE reports SET upvote_count = upvote_count + 1 WHERE id = $1',
                    [randomReport.id]
                );
            } catch (e) {
                // Ignore duplicate upvote errors
            }
        }
        console.log('✅ Added random upvotes');

        console.log('\n🎉 Background data seeded successfully!');
        console.log('\n📊 Summary:');
        console.log('   - 10 users created');
        console.log('   - 20 reports across Munich + TUM Garching');
        console.log('   - 5 reports at TUM Garching campus (for nearby demo)');
        console.log('   - Random upvotes added');
        console.log('\n✨ Map will look active and realistic!');
        console.log('\n🎓 TUM Garching Reports:');
        console.log('   - Broken bike rack (Informatik)');
        console.log('   - Dark streetlight (Maschinenwesen path)');
        console.log('   - Overflowing trash (Mensa)');
        console.log('   - Slippery floor (Mathematics)');
        console.log('   - Broken water fountain (Chemistry)');
        console.log('\n👉 Next: Create your 2-3 demo users manually in Supabase');
        console.log('💡 Demo Tip: Submit a duplicate of the streetlight report to show duplicate detection!\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
    } finally {
        await pool.end();
    }
}

seedBackgroundData();
