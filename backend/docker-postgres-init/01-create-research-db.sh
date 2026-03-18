#!/bin/bash
# Tạo database "research" nếu chưa tồn tại (dùng khi setup-db.json có databaseName: research).
# Chỉ chạy lần đầu khi Postgres khởi tạo volume (docker-entrypoint-initdb.d).
set -e
exists=$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = 'research'")
if [ "$exists" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -c "CREATE DATABASE research;"
  echo "Created database research."
else
  echo "Database research already exists."
fi
