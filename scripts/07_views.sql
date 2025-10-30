-- 07_views.sql (SOURCE project)
-- Normal views
SELECT 'CREATE OR REPLACE VIEW ' || quote_ident(v.table_schema) || '.' || quote_ident(v.table_name)
       || ' AS ' || v.view_definition || ';' AS sql
FROM information_schema.views v
WHERE v.table_schema IN ('public','auth','storage')
ORDER BY v.table_schema, v.table_name;

-- Materialized views (separate SELECT)
-- Note: information_schema doesn’t list matviews; use pg_matviews
-- If pg_matviews exists:
-- SELECT 'CREATE MATERIALIZED VIEW ' || quote_ident(schemaname) || '.' || quote_ident(matviewname)
--        || ' AS ' || definition || ';' AS sql
-- FROM pg_matviews
-- WHERE schemaname IN ('public','auth','storage')
-- ORDER BY schemaname, matviewname;





--Run that above first in the existing database and that below to the new database:




| sql                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE OR REPLACE VIEW public.account_activities_with_user_info AS  SELECT aa.id,
    aa.user_id,
    aa.client_id,
    aa.activity_type,
    aa.title,
    aa.description,
    aa.currency,
    aa.display_amount,
    aa.status,
    aa.priority,
    aa.is_read,
    aa.created_by,
    aa.created_at,
    aa.updated_at,
    aa.expires_at,
    aa.metadata,
    p.full_name AS user_full_name,
    p.email AS user_email,
    u.first_name,
    u.last_name,
    u.kyc_status
   FROM ((account_activities aa
     LEFT JOIN profiles p ON ((aa.user_id = p.id)))
     LEFT JOIN users u ON ((aa.user_id = u.id)));;                                                                                                                                                                                                                                                                                                                    |
| CREATE OR REPLACE VIEW public.admin_crypto_deposits AS  SELECT ct.id,
    ct.user_id,
    COALESCE(p.full_name, u.full_name, concat(u.first_name, ' ', u.last_name)) AS user_name,
    COALESCE(p.email, u.email) AS user_email,
    p.client_id,
    ct.crypto_type,
    ct.amount,
    ct.network,
    ct.wallet_address,
    ct.transaction_hash,
    ct.gas_fee,
    ct.status,
    ct.admin_notes,
    ct.created_at,
        CASE
            WHEN (ct.status = 'Completed'::text) THEN 'Approved'::text
            WHEN (ct.status = 'Pending'::text) THEN 'Pending Review'::text
            WHEN (ct.status = 'Failed'::text) THEN 'Rejected'::text
            ELSE ct.status
        END AS display_status
   FROM ((crypto_transactions ct
     LEFT JOIN profiles p ON ((ct.user_id = p.id)))
     LEFT JOIN users u ON ((ct.user_id = u.id)))
  WHERE (ct.transaction_type = 'Deposit'::text)
  ORDER BY ct.created_at DESC;; |
| CREATE OR REPLACE VIEW public.crypto_balance_summary AS  SELECT ncb.user_id,
    COALESCE(p.full_name, u.full_name, concat(u.first_name, ' ', u.last_name)) AS user_name,
    COALESCE(p.email, u.email) AS user_email,
    p.client_id,
    ncb.btc_balance,
    ncb.eth_balance,
    ncb.usdt_balance,
    ((ncb.btc_balance + ncb.eth_balance) + ncb.usdt_balance) AS total_crypto_value,
    ncb.created_at,
    ncb.updated_at
   FROM ((newcrypto_balances ncb
     LEFT JOIN profiles p ON ((ncb.user_id = p.id)))
     LEFT JOIN users u ON ((ncb.user_id = u.id)));;                                                                                                                                                                                                                                                                                                                                                                |
| CREATE OR REPLACE VIEW public.crypto_transaction_history AS  SELECT ct.id,
    ct.user_id,
    COALESCE(p.full_name, u.full_name, concat(u.first_name, ' ', u.last_name)) AS user_name,
    COALESCE(p.email, u.email) AS user_email,
    p.client_id,
    ct.crypto_type,
    ct.transaction_type,
    ct.amount,
    ct.total_value,
    ct.wallet_address,
    ct.network,
    ct.transaction_hash,
    ct.gas_fee,
    ct.status,
    ct.admin_notes,
    ct.created_at
   FROM ((crypto_transactions ct
     LEFT JOIN profiles p ON ((ct.user_id = p.id)))
     LEFT JOIN users u ON ((ct.user_id = u.id)))
  ORDER BY ct.created_at DESC;;                                                                                                                                                                                                                                                                                            |
| CREATE OR REPLACE VIEW public.crypto_transfer_analytics AS  SELECT crypto_type,
    network,
    count(*) AS total_transfers,
    sum(amount) AS total_amount,
    sum(gas_fee) AS total_fees,
    avg(amount) AS avg_amount,
    avg(gas_fee) AS avg_fee,
    count(
        CASE
            WHEN (status = 'Completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_transfers,
    count(
        CASE
            WHEN (status = 'Pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_transfers,
    count(
        CASE
            WHEN (status = 'Failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_transfers
   FROM crypto_transactions ct
  WHERE (transaction_type = 'Transfer'::text)
  GROUP BY crypto_type, network
  ORDER BY (count(*)) DESC;;                                                                                                 |