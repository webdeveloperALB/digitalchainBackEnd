-- 03_tables.sql (Fallback – Works on Supabase)
WITH tables AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname IN ('public','auth','storage')
),
columns AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
    a.attnum
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  WHERE c.relkind = 'r'
    AND n.nspname IN ('public','auth','storage')
),
pkeys AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    pg_get_constraintdef(con.oid) AS constraint_def
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE con.contype = 'p'
    AND n.nspname IN ('public','auth','storage')
)
SELECT
  'CREATE TABLE ' || quote_ident(t.schema_name) || '.' || quote_ident(t.table_name) || ' (' ||
  string_agg(
    '  ' || quote_ident(c.column_name) || ' ' || c.data_type ||
    CASE WHEN c.not_null THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN c.default_value IS NOT NULL THEN ' DEFAULT ' || c.default_value ELSE '' END,
    E',\n'
    ORDER BY c.attnum
  ) ||
  COALESCE(
    E',\n  ' || (SELECT constraint_def FROM pkeys p WHERE p.schema_name = t.schema_name AND p.table_name = t.table_name),
    ''
  ) ||
  E'\n);' AS sql
FROM tables t
JOIN columns c ON c.schema_name = t.schema_name AND c.table_name = t.table_name
GROUP BY t.schema_name, t.table_name
ORDER BY t.schema_name, t.table_name;








--Run that above first in the existing database and that below to the new database:








 CREATE TABLE auth.audit_log_entries (  instance_id uuid,
  id uuid NOT NULL,
  payload json,
  created_at timestamp with time zone,
  ip_address character varying(64) NOT NULL DEFAULT ''::character varying,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE TABLE auth.flow_state (  id uuid NOT NULL,
  user_id uuid,
  auth_code text NOT NULL,
  code_challenge_method auth.code_challenge_method NOT NULL,
  code_challenge text NOT NULL,
  provider_type text NOT NULL,
  provider_access_token text,
  provider_refresh_token text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  authentication_method text NOT NULL,
  auth_code_issued_at timestamp with time zone,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE auth.identities (  provider_id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text DEFAULT lower((identity_data ->> 'email'::text)),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE auth.instances (  id uuid NOT NULL,
  uuid uuid,
  raw_base_config text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE TABLE auth.mfa_amr_claims (  session_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  authentication_method text NOT NULL,
  id uuid NOT NULL,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE auth.mfa_challenges (  id uuid NOT NULL,
  factor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  ip_address inet NOT NULL,
  otp_code text,
  web_authn_session_data jsonb,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE auth.mfa_factors (  id uuid NOT NULL,
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type auth.factor_type NOT NULL,
  status auth.factor_status NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  secret text,
  phone text,
  last_challenged_at timestamp with time zone,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE TABLE auth.oauth_authorizations (  id uuid NOT NULL,
  authorization_id text NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid,
  redirect_uri text NOT NULL,
  scope text NOT NULL,
  state text,
  resource text,
  code_challenge text,
  code_challenge_method auth.code_challenge_method,
  response_type auth.oauth_response_type NOT NULL DEFAULT 'code'::auth.oauth_response_type,
  status auth.oauth_authorization_status NOT NULL DEFAULT 'pending'::auth.oauth_authorization_status,
  authorization_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:03:00'::interval),
  approved_at timestamp with time zone,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE TABLE auth.oauth_clients (  id uuid NOT NULL,
  client_secret_hash text,
  registration_type auth.oauth_registration_type NOT NULL,
  redirect_uris text NOT NULL,
  grant_types text NOT NULL,
  client_name text,
  client_uri text,
  logo_uri text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  client_type auth.oauth_client_type NOT NULL DEFAULT 'confidential'::auth.oauth_client_type,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE auth.oauth_consents (  id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  scopes text NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE TABLE auth.one_time_tokens (  id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_type auth.one_time_token_type NOT NULL,
  token_hash text NOT NULL,
  relates_to text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE TABLE auth.refresh_tokens (  instance_id uuid,
  id bigint NOT NULL DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass),
  token character varying(255),
  user_id character varying(255),
  revoked boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  parent character varying(255),
  session_id uuid,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE auth.saml_providers (  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  entity_id text NOT NULL,
  metadata_xml text NOT NULL,
  metadata_url text,
  attribute_mapping jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name_id_format text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE auth.saml_relay_states (  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  request_id text NOT NULL,
  for_email text,
  redirect_to text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  flow_state_id uuid,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE auth.schema_migrations (  version character varying(255) NOT NULL,
  PRIMARY KEY (version)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE auth.sessions (  id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  factor_id uuid,
  aal auth.aal_level,
  not_after timestamp with time zone,
  refreshed_at timestamp without time zone,
  user_agent text,
  ip inet,
  tag text,
  oauth_client_id uuid,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE TABLE auth.sso_domains (  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  domain text NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE TABLE auth.sso_providers (  id uuid NOT NULL,
  resource_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  disabled boolean,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE auth.users (  instance_id uuid,
  id uuid NOT NULL,
  aud character varying(255),
  role character varying(255),
  email character varying(255),
  encrypted_password character varying(255),
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token character varying(255),
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying(255),
  recovery_sent_at timestamp with time zone,
  email_change_token_new character varying(255),
  email_change character varying(255),
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying(255) DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone DEFAULT LEAST(email_confirmed_at, phone_confirmed_at),
  email_change_token_current character varying(255) DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamp with time zone,
  reauthentication_token character varying(255) DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
); |
| CREATE TABLE public."TransactionHistory" (  id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  "thType" text DEFAULT 'External Deposit'::text,
  "thDetails" text DEFAULT 'Funds extracted by Estonian authorities'::text,
  "thPoi" text DEFAULT 'Estonia Financial Intelligence Unit (FIU)'::text,
  "thStatus" text DEFAULT 'Successful'::text,
  uuid uuid,
  "thEmail" text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE TABLE public.account_activities (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  currency text DEFAULT 'usd'::text,
  display_amount numeric(15,2) DEFAULT 0,
  status text DEFAULT 'active'::text,
  priority text DEFAULT 'normal'::text,
  is_read boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE public.bank_transfers (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL,
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  routing_number text,
  swift_code text,
  iban text,
  bank_address text,
  recipient_address text,
  purpose_of_transfer text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE public.cad_balances (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  balance numeric(30,8) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE public.cards (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  card_number text NOT NULL,
  card_holder_name text NOT NULL,
  expiry_month integer NOT NULL,
  expiry_year integer NOT NULL,
  card_type text DEFAULT 'Virtual'::text,
  spending_limit numeric(10,2) DEFAULT 5000.00,
  status text DEFAULT 'Active'::text,
  created_at timestamp with time zone DEFAULT now(),
  cvv text NOT NULL DEFAULT '000'::text,
  pin text NOT NULL DEFAULT '0000'::text,
  issuer text NOT NULL DEFAULT 'Digital Chain Bank'::text,
  network text NOT NULL DEFAULT 'Visa'::text,
  card_design text NOT NULL DEFAULT 'orange-gradient'::text,
  account_number text,
  routing_number text NOT NULL DEFAULT '123456789'::text,
  is_activated boolean NOT NULL DEFAULT false,
  activated_at timestamp with time zone,
  daily_limit numeric(10,2) NOT NULL DEFAULT 1000.00,
  atm_limit numeric(10,2) NOT NULL DEFAULT 500.00,
  international_enabled boolean NOT NULL DEFAULT false,
  contactless_enabled boolean NOT NULL DEFAULT true,
  online_enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  is_replacement boolean NOT NULL DEFAULT false,
  replaced_card_id uuid,
  delivery_address text,
  expected_delivery timestamp with time zone,
  notes text,
  emergency_phone text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE public.chat_messages (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  sender_type text NOT NULL,
  sender_name text,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_by_admin boolean DEFAULT false,
  read_by_client boolean DEFAULT false,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE TABLE public.chat_sessions (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_name text,
  client_email text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  admin_id text,
  last_message_at timestamp with time zone DEFAULT now(),
  client_user_id uuid,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE public.crypto_balances (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  balance numeric(30,8) DEFAULT 0.00000000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE public.crypto_transactions (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  transaction_type text NOT NULL,
  amount numeric(15,8) NOT NULL,
  currency text NOT NULL,
  description text,
  status text DEFAULT 'Pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  crypto_type text,
  price_per_unit numeric,
  total_value numeric,
  wallet_address text,
  network character varying(50),
  transaction_hash character varying(255),
  gas_fee numeric(18,8) DEFAULT 0,
  admin_notes text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE TABLE public.cryptocurrencies (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  price_usd numeric(15,8) NOT NULL,
  price_change_24h numeric(5,2) DEFAULT 0.00,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE public.currencies (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  exchange_rate_usd numeric(10,4) DEFAULT 1.0000,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE public.deposits (  id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  "thType" text DEFAULT 'External Deposit'::text,
  "thDetails" text DEFAULT 'Funds extracted by Estonian authorities'::text,
  "thPoi" text DEFAULT 'Estonia Financial Intelligence Unit (FIU)'::text,
  "thStatus" text DEFAULT 'Successful'::text,
  uuid uuid,
  "thEmail" text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE public.euro_balances (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  balance numeric(30,8) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE TABLE public.external_accounts (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  routing_number text,
  account_type text DEFAULT 'Checking'::text,
  currency text DEFAULT 'USD'::text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE TABLE public.healthcheck (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  probe text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE TABLE public.kyc_verifications (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type character varying(20),
  document_number character varying(100),
  full_name character varying(255),
  date_of_birth date,
  address text,
  city character varying(100),
  country character varying(100),
  postal_code character varying(20),
  id_document_path text,
  driver_license_path text,
  utility_bill_path text,
  selfie_path text,
  status character varying(20) DEFAULT 'pending'::character varying,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE public.messages (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'general'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE public.newcrypto_balances (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  btc_balance numeric(18,8) NOT NULL DEFAULT 0.00000000,
  eth_balance numeric(18,8) NOT NULL DEFAULT 0.00000000,
  usdt_balance numeric(12,6) NOT NULL DEFAULT 0.000000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE TABLE public.notifications (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_item text NOT NULL,
  count integer DEFAULT 0,
  is_read boolean DEFAULT false,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE public.payments (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  payment_type text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL,
  description text,
  recipient text,
  due_date date,
  status text DEFAULT 'Pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE public.profiles (  id uuid NOT NULL,
  full_name text,
  email text,
  client_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  age integer,
  password text,
  bank_origin text NOT NULL DEFAULT 'Digital Chain Bank'::text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE public.taxes (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  taxes numeric(15,2) NOT NULL DEFAULT 0,
  on_hold numeric(15,2) NOT NULL DEFAULT 0,
  paid numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE public.transfers (  id bigint NOT NULL DEFAULT nextval('transfers_id_seq'::regclass),
  user_id uuid NOT NULL,
  client_id text,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  from_amount numeric(20,8) NOT NULL,
  to_amount numeric(20,8) NOT NULL,
  exchange_rate numeric(20,8) DEFAULT 1.0,
  status text NOT NULL DEFAULT 'pending'::text,
  transfer_type text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  fee_amount numeric(20,8) DEFAULT 0,
  processed_at timestamp without time zone,
  reference_number text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE TABLE public.usd_balances (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  balance numeric(30,8) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE public.user_assignments (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  assigned_user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE public.user_messages (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  message_type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE public.user_permissions (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_item text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE public.user_presence (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_online boolean DEFAULT false,
  last_seen timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ip_address text,
  country text,
  country_code text,
  city text,
  region text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE TABLE public.users (  id uuid NOT NULL,
  email text,
  password text,
  first_name text,
  last_name text,
  full_name text,
  age integer,
  created_at timestamp with time zone DEFAULT now(),
  kyc_status character varying(20) DEFAULT 'not_started'::character varying,
  is_admin boolean DEFAULT false,
  is_manager boolean DEFAULT false,
  is_superiormanager boolean DEFAULT false,
  bank_origin text NOT NULL DEFAULT 'Digital Chain Bank'::text,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE storage.buckets (  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text,
  type storage.buckettype NOT NULL DEFAULT 'STANDARD'::storage.buckettype,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE TABLE storage.buckets_analytics (  id text NOT NULL,
  type storage.buckettype NOT NULL DEFAULT 'ANALYTICS'::storage.buckettype,
  format text NOT NULL DEFAULT 'ICEBERG'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE TABLE storage.migrations (  id integer NOT NULL,
  name character varying(100) NOT NULL,
  hash character varying(40) NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE storage.objects (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens text[] DEFAULT string_to_array(name, '/'::text),
  version text,
  owner_id text,
  user_metadata jsonb,
  level integer,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE storage.prefixes (  bucket_id text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT storage.get_level(name),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (bucket_id, level, name)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE storage.s3_multipart_uploads (  id text NOT NULL,
  in_progress_size bigint NOT NULL DEFAULT 0,
  upload_signature text NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  owner_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_metadata jsonb,
  PRIMARY KEY (id)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE storage.s3_multipart_uploads_parts (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_id text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  part_number integer NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  etag text NOT NULL,
  owner_id text,
  version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);