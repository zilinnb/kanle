#!/bin/sh
set -e

echo "Waiting for MySQL at $DB_HOST:$DB_PORT ..."

until node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
}).then(c => c.end()).catch(() => process.exit(1))
" 2>/dev/null; do
  echo "MySQL not ready, retry in 2s..."
  sleep 2
done

echo "MySQL ready. Running seed..."
node dist/scripts/seed.js

echo "Starting backend..."
exec node dist/index.js
