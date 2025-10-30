-- 01_extensions.sql (SOURCE project)
SELECT 'CREATE EXTENSION IF NOT EXISTS ' 
       || quote_ident(e.extname) 
       || COALESCE(' WITH SCHEMA ' || quote_ident(n.nspname), '') 
       || ';' AS sql
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
-- Keep common Supabase extensions. Exclude pg_* built-ins that don't need manual creation.
WHERE e.extname NOT IN ('plpgsql')  -- plpgsql is built-in
ORDER BY e.extname;



--Run that above first in the existing database and that below to the new database:




 CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;            
 CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions; 
 CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;           
 CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;          
 CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;        