#!/bin/bash
# Runs once, on a fresh Postgres volume, before any migrations.
#
# Creates the non-superuser role the app connects as and hands it ownership of
# the database and public schema. Ownership is required so migrations can run
# as the same role; FORCE ROW LEVEL SECURITY then applies to it too.
set -euo pipefail

: "${DB_APP_USER:?DB_APP_USER is required}"
: "${DB_APP_PASSWORD:?DB_APP_PASSWORD is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

if [[ ! "$DB_APP_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "DB_APP_USER must be a simple SQL identifier" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_APP_USER}') THEN
      CREATE ROLE ${DB_APP_USER}
        LOGIN
        PASSWORD '${DB_APP_PASSWORD}'
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOBYPASSRLS;
    END IF;
  END
  \$\$;

  ALTER DATABASE ${POSTGRES_DB} OWNER TO ${DB_APP_USER};
  ALTER SCHEMA public OWNER TO ${DB_APP_USER};
  GRANT ALL ON SCHEMA public TO ${DB_APP_USER};
SQL

echo "Created app role ${DB_APP_USER} and transferred schema ownership."
