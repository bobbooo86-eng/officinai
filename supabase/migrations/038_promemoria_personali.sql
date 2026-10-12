-- ============================================
-- OfficinAI - Migrazione 038
-- Promemoria personali sulla Home: note libere scritte dal titolare
-- (non legate a nessun appuntamento/cliente), es. "chiamare il fornitore
-- lunedi'". Da non confondere con promemoria_nascosti (024), che memorizza
-- solo quali avvisi automatici sono stati nascosti.
--
-- Stessa impostazione minimale di movimenti/promemoria_nascosti: nessuna
-- chiave esterna, una sola policy, sicura da rieseguire.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS promemoria_personali (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id uuid NOT NULL,
  testo       text NOT NULL,
  fatto       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promemoria_personali_officina ON promemoria_personali(officina_id);

ALTER TABLE promemoria_personali ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promemoria_personali_staff ON promemoria_personali;
CREATE POLICY promemoria_personali_staff ON promemoria_personali FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- Aggiornamento in tempo reale fra dispositivi. Richiede privilegi che
-- l'utente della SQL Editor puo' non avere: l'errore viene ignorato, perche'
-- senza realtime la pagina si aggiorna comunque riaprendola.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'promemoria_personali'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE promemoria_personali';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Realtime non attivato su promemoria_personali: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
