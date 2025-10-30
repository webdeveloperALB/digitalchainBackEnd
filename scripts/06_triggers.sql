-- 06_triggers.sql (SOURCE project)
-- Recreate CREATE TRIGGER statements.
WITH trigs AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname  AS trigger_name,
    pg_get_triggerdef(t.oid, true) AS trigger_def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname IN ('public','auth','storage')
)
SELECT 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_name) || ' ON '
       || quote_ident(schema_name) || '.' || quote_ident(table_name) || ';' AS sql
FROM trigs
UNION ALL
SELECT trigger_def || ';' AS sql
FROM trigs
ORDER BY sql;



--Run that above first in the existing database and that below to the new database:



| sql                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();                                          |
| CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();                                                              |
| CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();                                                               |
| CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (new.name <> old.name OR new.bucket_id <> old.bucket_id) EXECUTE FUNCTION storage.objects_update_prefix_trigger(); |
| CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN (pg_trigger_depth() < 1) EXECUTE FUNCTION storage.prefixes_insert_trigger();                                         |
| CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();                                                                |
| CREATE TRIGGER trg_prevent_zero_overwrite_cad BEFORE UPDATE ON cad_balances FOR EACH ROW EXECUTE FUNCTION prevent_zero_overwrite();                                                                               |
| CREATE TRIGGER trg_prevent_zero_overwrite_eur BEFORE UPDATE ON euro_balances FOR EACH ROW EXECUTE FUNCTION prevent_zero_overwrite();                                                                              |
| CREATE TRIGGER trg_prevent_zero_overwrite_usd BEFORE UPDATE ON usd_balances FOR EACH ROW EXECUTE FUNCTION prevent_zero_overwrite();                                                                               |
| CREATE TRIGGER trigger_update_user_presence_updated_at BEFORE UPDATE ON user_presence FOR EACH ROW EXECUTE FUNCTION update_user_presence_updated_at();                                                            |
| CREATE TRIGGER update_account_activities_updated_at BEFORE UPDATE ON account_activities FOR EACH ROW EXECUTE FUNCTION update_account_activities_updated_at();                                                     |
| CREATE TRIGGER update_chat_session_timestamp_trigger BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_chat_session_timestamp();                                                                |
| CREATE TRIGGER update_kyc_verifications_updated_at BEFORE UPDATE ON kyc_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                   |
| CREATE TRIGGER update_newcrypto_balances_updated_at BEFORE UPDATE ON newcrypto_balances FOR EACH ROW EXECUTE FUNCTION update_newcrypto_balances_updated_at();                                                     |
| CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();                                                                       |
| CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                                     |
| CREATE TRIGGER update_taxes_updated_at BEFORE UPDATE ON taxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                                           |
| CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                           |
| DROP TRIGGER IF EXISTS enforce_bucket_name_length_trigger ON storage.buckets;                                                                                                                                     |
| DROP TRIGGER IF EXISTS objects_delete_delete_prefix ON storage.objects;                                                                                                                                           |
| DROP TRIGGER IF EXISTS objects_insert_create_prefix ON storage.objects;                                                                                                                                           |
| DROP TRIGGER IF EXISTS objects_update_create_prefix ON storage.objects;                                                                                                                                           |
| DROP TRIGGER IF EXISTS prefixes_create_hierarchy ON storage.prefixes;                                                                                                                                             |
| DROP TRIGGER IF EXISTS prefixes_delete_hierarchy ON storage.prefixes;                                                                                                                                             |
| DROP TRIGGER IF EXISTS trg_prevent_zero_overwrite_cad ON public.cad_balances;                                                                                                                                     |
| DROP TRIGGER IF EXISTS trg_prevent_zero_overwrite_eur ON public.euro_balances;                                                                                                                                    |
| DROP TRIGGER IF EXISTS trg_prevent_zero_overwrite_usd ON public.usd_balances;                                                                                                                                     |
| DROP TRIGGER IF EXISTS trigger_update_user_presence_updated_at ON public.user_presence;                                                                                                                           |
| DROP TRIGGER IF EXISTS update_account_activities_updated_at ON public.account_activities;                                                                                                                         |
| DROP TRIGGER IF EXISTS update_chat_session_timestamp_trigger ON public.chat_sessions;                                                                                                                             |
| DROP TRIGGER IF EXISTS update_kyc_verifications_updated_at ON public.kyc_verifications;                                                                                                                           |
| DROP TRIGGER IF EXISTS update_newcrypto_balances_updated_at ON public.newcrypto_balances;                                                                                                                         |
| DROP TRIGGER IF EXISTS update_objects_updated_at ON storage.objects;                                                                                                                                              |
| DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;                                                                                                                                             |
| DROP TRIGGER IF EXISTS update_taxes_updated_at ON public.taxes;                                                                                                                                                   |
| DROP TRIGGER IF EXISTS update_user_presence_updated_at ON public.user_presence;                                                                                                                                   |