#!/bin/sh
# Boots a temporary Postgres, applies the Supabase stubs, then runs every
# migration in order with ON_ERROR_STOP so the first failure is fatal.
set -e

export PGDATA=/tmp/pgdata
export PGUSER=postgres
mkdir -p "$PGDATA" && chown postgres "$PGDATA"

su postgres -c "initdb -D $PGDATA -A trust" > /dev/null
su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=' -w start" > /dev/null

run() {
  printf '  %-42s' "$(basename "$1")"
  if su postgres -c "psql -v ON_ERROR_STOP=1 -q -d postgres -f '$1'" 2>/tmp/err; then
    echo "OK"
  else
    echo "FAILED"
    echo
    sed 's/^/      /' /tmp/err
    exit 1
  fi
}

echo "Supabase stubs:"
run /supabase/validate/00_stubs.sql

echo
echo "Migrations:"
for f in $(ls /supabase/migrations/*.sql | sort); do
  run "$f"
done

echo
echo "Re-running every migration (idempotency check):"
run /supabase/validate/00_stubs.sql
for f in $(ls /supabase/migrations/*.sql | sort); do
  run "$f"
done

echo
echo "All migrations applied cleanly, twice."
