-- ============================================
-- OfficinAI - Migrazione 024
-- Promemoria nascosti sulla Home: scadenze veicoli e crediti da incassare
-- che il titolare ha scelto di non vedere piu' li'. Non cancella il dato
-- vero (la scadenza sul veicolo, il credito sull'appuntamento), solo la
-- sua comparsa nella dashboard.
--
-- Stessa impostazione minimale di movimenti (016): nessuna chiave esterna,
-- una sola policy, sicura da rieseguire.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS promemoria_nascosti (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id uuid NOT NULL,
  -- Identifica cosa e' stato nascosto, es. "credito:<appuntamento_id>" o
  -- "scadenza:<veicolo_id>:<tipo>:<data>". Se la data di una scadenza
  -- cambia (rinnovo), la chiave cambia e il promemoria torna a comparire.
  chiave      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (officina_id, chiave)
);

ALTER TABLE promemoria_nascosti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promemoria_nascosti_staff ON promemoria_nascosti;
CREATE POLICY promemoria_nascosti_staff ON promemoria_nascosti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

NOTIFY pgrst, 'reload schema';
