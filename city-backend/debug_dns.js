const dns = require('dns');

const hostnames = [
    'aws-1-eu-west-1.pooler.supabase.com',
    'db.dbejkqpadeuagxauunfv.supabase.co'
];

console.log('Node.js version:', process.version);
console.log('Testing DNS resolution...');

hostnames.forEach(hostname => {
    console.log(`\nLooking up: ${hostname}`);

    // Default lookup (IPv4 or IPv6)
    dns.lookup(hostname, (err, address, family) => {
        if (err) {
            console.error(`[Default] Error: ${err.message}`);
        } else {
            console.log(`[Default] Address: ${address}, Family: IPv${family}`);
        }
    });

    // Force IPv4
    dns.lookup(hostname, { family: 4 }, (err, address, family) => {
        if (err) {
            console.error(`[IPv4] Error: ${err.message}`);
        } else {
            console.log(`[IPv4] Address: ${address}, Family: IPv${family}`);
        }
    });
});
