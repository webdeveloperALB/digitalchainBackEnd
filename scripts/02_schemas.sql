-- 02_schemas.sql (SOURCE project)
SELECT 'CREATE SCHEMA IF NOT EXISTS ' || quote_ident(n.nspname) || ';' AS sql
FROM pg_namespace n
WHERE n.nspname IN ('public','auth','storage')
ORDER BY n.nspname;



--Run that above first in the existing database and that below to the new database:



 CREATE SCHEMA IF NOT EXISTS auth;    
 CREATE SCHEMA IF NOT EXISTS public; 
 CREATE SCHEMA IF NOT EXISTS storage; 
