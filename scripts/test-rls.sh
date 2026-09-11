#!/bin/sh
# Applies stubs + migrations to a throwaway Postgres, then runs the
# behavioural RLS test suite.
set -e

export PGDATA=/tmp/pgdata PGUSER=postgres
mkdir -p "$PGDATA" && chown postgres "$PGDATA"
su postgres -c "initdb -D $PGDATA -A trust" > /dev/null
su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=' -w start" > /dev/null

su postgres -c "psql -v ON_ERROR_STOP=1 -q -d postgres -f /supabase/validate/00_stubs.sql"
for f in $(ls /supabase/migrations/*.sql | sort); do
  su postgres -c "psql -v ON_ERROR_STOP=1 -q -d postgres -f '$f'"
done

echo "Schema ready. Running RLS behaviour tests:"
for t in $(ls /supabase/validate/[1-9]*_*.sql | sort); do
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d postgres -f '$t'" 2>&1 \
  | grep -v '^SET$\|^GRANT$\|^INSERT\|^UPDATE\|^DELETE\|^ *report *$\|^-\+$\|^([0-9]* row' \
  | sed 's/^NOTICE:  //'
done
