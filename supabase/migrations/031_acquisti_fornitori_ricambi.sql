-- ============================================
-- OfficinAI - Migrazione 031
-- Acquisti registrati a mano sul conto di un fornitore di ricambi
-- (Autoricambi/Monti), non legati a nessuna consegna specifica: es. un
-- pezzo comprato per magazzino, non ancora montato su un'auto di un
-- cliente. Alza il debito verso quel fornitore, come i ricambi segnati
-- sulle consegne.
--
-- Stessa impostazione minimale di movimenti/promemoria_nascosti: nessuna
-- chiave esterna, una sola policy, sicura da rieseguire.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS acquisti_fornitori_ricambi (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id  uuid NOT NULL,
  fornitore    text NOT NULL CHECK (fornitore IN ('autoricambi', 'monti')),
  descrizione  text NOT NULL DEFAULT '',
  importo      numeric(10,2) NOT NULL DEFAULT 0,
  data         date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acquisti_fornitori_ricambi_officina ON acquisti_fornitori_ricambi(officina_id, fornitore);

ALTER TABLE acquisti_fornitori_ricambi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acquisti_fornitori_ricambi_staff ON acquisti_fornitori_ricambi;
CREATE POLICY acquisti_fornitori_ricambi_staff ON acquisti_fornitori_ricambi FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- Aggiornamento in tempo reale fra dispositivi. Richiede privilegi che
-- l'utente della SQL Editor puo' non avere: l'errore viene ignorato, perche'
-- senza realtime la pagina si aggiorna comunque riaprendola.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'acquisti_fornitori_ricambi'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE acquisti_fornitori_ricambi';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Realtime non attivato su acquisti_fornitori_ricambi: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
