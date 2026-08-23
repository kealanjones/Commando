#!/usr/bin/env bash
# Apply the migrations to a throwaway Postgres and prove the RLS policies.
# Needs a local Postgres; see tests/rls.sql for what is asserted.
set -euo pipefail
cd "$(dirname "$0")/.."
PGH=${PGHOST:-/var/run/postgresql}
PGP=${PGPORT:-5433}
psql -h "$PGH" -p "$PGP" -U postgres -q -c "drop database if exists reg_test;" -c "create database reg_test;"
psql -h "$PGH" -p "$PGP" -U postgres -d reg_test -v ON_ERROR_STOP=1 -q -f tests/supabase-shim.sql
for f in supabase/migrations/0*.sql; do
  psql -h "$PGH" -p "$PGP" -U postgres -d reg_test -v ON_ERROR_STOP=1 -q -f "$f"
done
psql -h "$PGH" -p "$PGP" -U postgres -d reg_test -v ON_ERROR_STOP=1 -f tests/rls.sql 2>&1 | grep -E 'PASS|FAIL|ERROR'
