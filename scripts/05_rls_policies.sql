-- 05_rls_policies.sql (SOURCE project)
-- Reconstruct CREATE POLICY statements for selected schemas.
WITH pol AS (
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
  FROM pg_policies p
  WHERE p.schemaname IN ('public','auth','storage')
)
SELECT
  'CREATE POLICY ' || quote_ident(policyname) 
  || ' ON ' || quote_ident(schemaname) || '.' || quote_ident(tablename)
  || ' AS ' || CASE WHEN permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END
  || ' FOR ' || UPPER(cmd)
  || CASE WHEN roles IS NOT NULL AND array_length(roles,1) > 0
          THEN ' TO ' || array_to_string(ARRAY(
                 SELECT quote_ident(r) FROM unnest(roles) AS r
               ), ', ')
          ELSE ''
     END
  || CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END
  || CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END
  || ';' AS sql
FROM pol
ORDER BY schemaname, tablename, policyname;
