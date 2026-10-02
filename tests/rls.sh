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

# 0009 rewrites data, so prove it on a register that has the old shapes in
# it: migrate to 0008, add watch and parked items, then let the test apply it.
psql -h "$PGH" -p "$PGP" -U postgres -q -c "drop database if exists reg_mig;" -c "create database reg_mig;"
psql -h "$PGH" -p "$PGP" -U postgres -d reg_mig -v ON_ERROR_STOP=1 -q -f tests/supabase-shim.sql
for f in supabase/migrations/0*.sql; do
  case "$f" in *0009_one_kind.sql) continue;; esac
  psql -h "$PGH" -p "$PGP" -U postgres -d reg_mig -v ON_ERROR_STOP=1 -q -f "$f"
done
psql -h "$PGH" -p "$PGP" -U postgres -d reg_mig -v ON_ERROR_STOP=1 -f tests/one_kind.sql 2>&1 | grep -E 'PASS|FAIL|ERROR'

# 0011 folds three levels into two, so prove it on a register that has
# groups with sections in them: migrate to 0010, add them, then apply it.
psql -h "$PGH" -p "$PGP" -U postgres -q -c "drop database if exists reg_two;" -c "create database reg_two;"
psql -h "$PGH" -p "$PGP" -U postgres -d reg_two -v ON_ERROR_STOP=1 -q -f tests/supabase-shim.sql
for f in supabase/migrations/0*.sql; do
  case "$f" in *0011_two_levels.sql) continue;; esac
  psql -h "$PGH" -p "$PGP" -U postgres -d reg_two -v ON_ERROR_STOP=1 -q -f "$f"
done
psql -h "$PGH" -p "$PGP" -U postgres -d reg_two -v ON_ERROR_STOP=1 -f tests/two_levels.sql 2>&1 | grep -E 'PASS|FAIL|ERROR'
