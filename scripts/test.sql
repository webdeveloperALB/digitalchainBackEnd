-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.TransactionHistory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  thType text DEFAULT 'External Deposit'::text,
  thDetails text DEFAULT 'Funds extracted by Estonian authorities'::text,
  thPoi text DEFAULT 'Estonia Financial Intelligence Unit (FIU)'::text,
  thStatus text DEFAULT 'Successful'::text,
  uuid uuid,
  thEmail text,
  CONSTRAINT TransactionHistory_pkey PRIMARY KEY (id),
  CONSTRAINT TransactionHistory_uuid_fkey FOREIGN KEY (uuid) REFERENCES auth.users(id)
);
CREATE TABLE public.account_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['admin_notification'::text, 'system_update'::text, 'security_alert'::text, 'account_notice'::text, 'service_announcement'::text, 'maintenance_notice'::text, 'policy_update'::text, 'feature_announcement'::text, 'account_credit'::text, 'account_debit'::text, 'transfer_notification'::text, 'deposit_notification'::text, 'withdrawal_notification'::text, 'payment_notification'::text, 'balance_inquiry'::text, 'transaction_alert'::text, 'receipt_notification'::text, 'wire_transfer'::text, 'ach_transfer'::text, 'check_deposit'::text, 'card_transaction'::text, 'mobile_payment'::text, 'online_banking'::text, 'account_opening'::text, 'account_closure'::text, 'account_freeze'::text, 'account_unfreeze'::text, 'limit_change'::text, 'fraud_alert'::text, 'kyc_update'::text, 'compliance_notice'::text, 'statement_ready'::text, 'promotional_offer'::text, 'service_update'::text, 'support_response'::text, 'appointment_reminder'::text, 'document_request'::text])),
  title text NOT NULL,
  description text,
  currency text DEFAULT 'usd'::text CHECK (currency = ANY (ARRAY['usd'::text, 'euro'::text, 'cad'::text, 'gbp'::text, 'jpy'::text, 'crypto'::text])),
  display_amount numeric DEFAULT 0,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text])),
  priority text DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  is_read boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT account_activities_pkey PRIMARY KEY (id),
  CONSTRAINT account_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT account_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.bank_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  CONSTRAINT bank_transfers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cad_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  balance numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cad_balances_pkey PRIMARY KEY (id),
  CONSTRAINT cad_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  card_number text NOT NULL,
  card_holder_name text NOT NULL,
  expiry_month integer NOT NULL,
  expiry_year integer NOT NULL,
  card_type text DEFAULT 'Virtual'::text,
  spending_limit numeric DEFAULT 5000.00,
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
  daily_limit numeric NOT NULL DEFAULT 1000.00,
  atm_limit numeric NOT NULL DEFAULT 500.00,
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
  CONSTRAINT cards_pkey PRIMARY KEY (id),
  CONSTRAINT cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['client'::text, 'admin'::text])),
  sender_name text,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_by_admin boolean DEFAULT false,
  read_by_client boolean DEFAULT false,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id)
);
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_name text,
  client_email text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'closed'::text, 'waiting'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  admin_id text,
  last_message_at timestamp with time zone DEFAULT now(),
  client_user_id uuid,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.crypto_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  balance numeric DEFAULT 0.00000000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crypto_balances_pkey PRIMARY KEY (id),
  CONSTRAINT crypto_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.crypto_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  description text,
  status text DEFAULT 'Pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  crypto_type text CHECK (crypto_type = ANY (ARRAY['BTC'::text, 'ETH'::text, 'USDT'::text])),
  price_per_unit numeric,
  total_value numeric,
  wallet_address text,
  network character varying CHECK (network::text = ANY (ARRAY['bitcoin'::character varying, 'lightning'::character varying, 'ethereum'::character varying, 'polygon'::character varying, 'arbitrum'::character varying, 'optimism'::character varying, 'tron'::character varying, 'bsc'::character varying, 'avalanche'::character varying]::text[])),
  transaction_hash character varying,
  gas_fee numeric DEFAULT 0,
  admin_notes text,
  CONSTRAINT crypto_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT crypto_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.cryptocurrencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL,
  price_usd numeric NOT NULL,
  price_change_24h numeric DEFAULT 0.00,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cryptocurrencies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.currencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  exchange_rate_usd numeric DEFAULT 1.0000,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT currencies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deposits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  thType text DEFAULT 'External Deposit'::text,
  thDetails text DEFAULT 'Funds extracted by Estonian authorities'::text,
  thPoi text DEFAULT 'Estonia Financial Intelligence Unit (FIU)'::text,
  thStatus text DEFAULT 'Successful'::text,
  uuid uuid,
  thEmail text,
  CONSTRAINT deposits_pkey PRIMARY KEY (id),
  CONSTRAINT deposits_uuid_fkey FOREIGN KEY (uuid) REFERENCES public.profiles(id)
);
CREATE TABLE public.euro_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  balance numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT euro_balances_pkey PRIMARY KEY (id),
  CONSTRAINT euro_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.external_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  routing_number text,
  account_type text DEFAULT 'Checking'::text,
  currency text DEFAULT 'USD'::text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT external_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT external_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.healthcheck (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  probe text,
  CONSTRAINT healthcheck_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kyc_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type character varying CHECK (document_type::text = ANY (ARRAY['passport'::character varying, 'id_card'::character varying]::text[])),
  document_number character varying,
  full_name character varying,
  date_of_birth date,
  address text,
  city character varying,
  country character varying,
  postal_code character varying,
  id_document_path text,
  driver_license_path text,
  utility_bill_path text,
  selfie_path text,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT kyc_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'general'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.newcrypto_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  btc_balance numeric NOT NULL DEFAULT 0.00000000,
  eth_balance numeric NOT NULL DEFAULT 0.00000000,
  usdt_balance numeric NOT NULL DEFAULT 0.000000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT newcrypto_balances_pkey PRIMARY KEY (id),
  CONSTRAINT newcrypto_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_item text NOT NULL,
  count integer DEFAULT 0,
  is_read boolean DEFAULT false,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  payment_type text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  description text,
  recipient text,
  due_date date,
  status text DEFAULT 'Pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  client_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  age integer CHECK (age IS NULL OR age >= 1 AND age <= 120),
  password text,
  bank_origin text NOT NULL DEFAULT 'Digital Chain Bank'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.taxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  taxes numeric NOT NULL DEFAULT 0,
  on_hold numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT taxes_pkey PRIMARY KEY (id),
  CONSTRAINT taxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.transfers (
  id bigint NOT NULL DEFAULT nextval('transfers_id_seq'::regclass),
  user_id uuid NOT NULL,
  client_id text,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  from_amount numeric NOT NULL,
  to_amount numeric NOT NULL,
  exchange_rate numeric DEFAULT 1.0,
  status text NOT NULL DEFAULT 'pending'::text,
  transfer_type text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  fee_amount numeric DEFAULT 0,
  processed_at timestamp without time zone,
  reference_number text,
  CONSTRAINT transfers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usd_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  balance numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usd_balances_pkey PRIMARY KEY (id),
  CONSTRAINT usd_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  assigned_user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT user_assignments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id),
  CONSTRAINT user_assignments_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id),
  CONSTRAINT user_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id)
);
CREATE TABLE public.user_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  message_type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_messages_pkey PRIMARY KEY (id),
  CONSTRAINT user_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_item text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  is_online boolean DEFAULT false,
  last_seen timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ip_address text,
  country text,
  country_code text,
  city text,
  region text,
  CONSTRAINT user_presence_pkey PRIMARY KEY (id),
  CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text,
  password text,
  first_name text,
  last_name text,
  full_name text,
  age integer,
  created_at timestamp with time zone DEFAULT now(),
  kyc_status character varying DEFAULT 'not_started'::character varying CHECK (kyc_status::text = ANY (ARRAY['not_started'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  is_admin boolean DEFAULT false,
  is_manager boolean DEFAULT false,
  is_superiormanager boolean DEFAULT false,
  bank_origin text NOT NULL DEFAULT 'Digital Chain Bank'::text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);