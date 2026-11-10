-- ============================================
-- OfficinAI - Migrazione 042
-- Tabelle abbonamenti/pagamenti: non esistevano affatto in produzione
-- (verificato via query dirette), nonostante webhook Stripe, RegisterPage
-- e SubscriptionPage le dessero per scontate da tempo. Senza queste due
-- tabelle, nessun pagamento Stripe viene mai registrato: il sistema non
-- si accorge se un'officina ha pagato o no.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS abbonamenti (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id            uuid NOT NULL UNIQUE,
  piano                  text NOT NULL DEFAULT 'professional' CHECK (piano IN ('starter', 'professional', 'enterprise')),
  stato                  text NOT NULL DEFAULT 'trial' CHECK (stato IN ('trial', 'attivo', 'scaduto')),
  data_inizio            timestamptz NOT NULL DEFAULT now(),
  data_fine              timestamptz NOT NULL,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abbonamenti_officina ON abbonamenti(officina_id);

CREATE TABLE IF NOT EXISTS pagamenti (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id  uuid NOT NULL,
  data         timestamptz NOT NULL DEFAULT now(),
  descrizione  text NOT NULL DEFAULT '',
  importo      numeric(10,2) NOT NULL DEFAULT 0,
  stato        text NOT NULL DEFAULT 'completato' CHECK (stato IN ('completato', 'in_attesa', 'fallito', 'rimborsato')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamenti_officina ON pagamenti(officina_id, data DESC);

ALTER TABLE abbonamenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamenti ENABLE ROW LEVEL SECURITY;

-- Lo staff vede/modifica solo l'abbonamento della propria officina. Le
-- scritture vere arrivano quasi sempre dal webhook Stripe (service role,
-- ignora RLS); questa policy serve per la lettura dalla pagina
-- Abbonamento e per l'inserimento della riga trial alla registrazione.
DROP POLICY IF EXISTS abbonamenti_staff ON abbonamenti;
CREATE POLICY abbonamenti_staff ON abbonamenti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- La riga trial viene creata da RegisterPage prima che esista una
-- sessione autenticata (stesso motivo delle altre pagine di registrazione).
DROP POLICY IF EXISTS abbonamenti_anon_insert ON abbonamenti;
CREATE POLICY abbonamenti_anon_insert ON abbonamenti FOR INSERT TO anon
  WITH CHECK (stato = 'trial');

DROP POLICY IF EXISTS pagamenti_staff_select ON pagamenti;
CREATE POLICY pagamenti_staff_select ON pagamenti FOR SELECT TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

NOTIFY pgrst, 'reload schema';
