-- Creates the least-privilege application role with a known password, so that
-- schema.sql's own random-password branch (which prints the value as a NOTICE
-- and is unusable in an automated deploy) is skipped by its IF NOT EXISTS check.
--
-- Demo/UAT only. On AWS the role is created by schema.sql itself and its
-- password lives in SSM.
--
-- On Neon this role is created via SQL, so it does NOT get membership in
-- neon_superuser and has no REPLICATION privilege. Neither is needed, and a
-- non-superuser app role is the point: RLS does not apply to superusers, so an
-- unprivileged role is what makes the policies meaningful.
--
-- Usage (psql):  psql "$DIRECT_URL" -v app_password="'<password>'" -f scripts/init-demo-db.sql
-- Or via the Node runner in scripts/apply-demo-schema.js, which substitutes it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pdms_app') THEN
    EXECUTE format('CREATE ROLE pdms_app LOGIN PASSWORD %L', :'app_password');
  ELSE
    EXECUTE format('ALTER ROLE pdms_app WITH PASSWORD %L', :'app_password');
  END IF;
END
$$;
