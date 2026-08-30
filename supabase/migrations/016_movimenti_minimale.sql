-- ============================================
-- OfficinAI - Migrazione 016
-- Creazione minimale della tabella movimenti (Cassa).
--
-- La 013 crea la stessa tabella con chiavi esterne, vincoli CHECK, indici,
-- quattro policy e l'aggancio al realtime. Ognuno di quei passaggi puo'
-- fallire su un database con schema disallineato, e in quel caso il SQL
-- Editor interrompe tutto lo script lasciando la Cassa non funzionante.
--
-- Qui resta solo l'indispensabile: nessuna chiave esterna, nessun CHECK,
-- una sola policy. L'integrita' referenziale e' comunque garantita dal
-- codice, che scrive sempre officina_id e tipi validi.
-- Sicura da eseguire anche se la 013 e' gia' passata.
-- ============================================

-- gen_random_uuid() vive in pgcrypto: su progetti vecchi puo' non essere
-- attiva, e senza questa riga la CREATE TABLE fallirebbe.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS movimenti (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id      uuid NOT NULL,
  tipo             text NOT NULL,
  importo          numeric(10,2) NOT NULL DEFAULT 0,
  descrizione      text NOT NULL DEFAULT '',
  metodo_pagamento text,
  data             date NOT NULL DEFAULT CURRENT_DATE,
  dipendente_id    uuid,
  created_by       uuid,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE movimenti ENABLE ROW LEVEL SECURITY;

-- Una sola policy che copre lettura e scrittura, limitata all'officina
-- dell'utente collegato.
DROP POLICY IF EXISTS movimenti_staff ON movimenti;
CREATE POLICY movimenti_staff ON movimenti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- Aggiornamento in tempo reale fra dispositivi. Richiede privilegi che
-- l'utente della SQL Editor puo' non avere: l'errore viene ignorato, perche'
-- senza realtime la cassa si aggiorna comunque riaprendo la schermata.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'movimenti'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE movimenti';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Realtime non attivato su movimenti: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
