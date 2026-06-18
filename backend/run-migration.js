require('dotenv').config();
const { query } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || './migrations/003_khata.sql';
const sql = fs.readFileSync(path.resolve(file), 'utf8');

query(sql)
  .then(() => { console.log('Migration OK:', file); process.exit(0); })
  .catch((e) => { console.error('Migration FAILED:', e.message); process.exit(1); });
