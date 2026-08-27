-- ============================================
-- OfficinAI - Migrazione 012
-- Tabella movimenti (cassa): incassi extra fuori appuntamento,
-- spese officina, spese titolari, anticipi e spese dipendenti.
-- ============================================

CREATE TABLE IF NOT EXISTS movimenti (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id   uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN (
                    'incasso_extra',
                    'spesa_officina',
                    'spesa_titolare',
                    'anticipo_dipendente',
                    'spesa_dipendente'
                  )),
  importo       numeric(10,2) NOT NULL CHECK (importo >= 0),
  descrizione   text NOT NULL DEFAULT '',
  metodo_pagamento text CHECK (metodo_pagamento IN (
                    'contanti', 'carta', 'bonifico', 'paypal', 'assegno', 'altro'
                  )),
  data          date NOT NULL DEFAULT CURRENT_DATE,
  dipendente_id uuid REFERENCES utenti(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES utenti(id) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimenti_officina_data ON movimenti(officina_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_movimenti_tipo ON movimenti(officina_id, tipo, data DESC);
CREATE INDEX IF NOT EXISTS idx_movimenti_dipendente ON movimenti(dipendente_id) WHERE dipendente_id IS NOT NULL;

ALTER TABLE movimenti ENABLE ROW LEVEL SECURITY;

-- Staff dell'officina puo leggere tutti i movimenti della propria officina
DROP POLICY IF EXISTS movimenti_staff_select ON movimenti;
CREATE POLICY movimenti_staff_select ON movimenti FOR SELECT TO authenticated
  USING (officina_id IN (
    SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true
  ));

-- Staff puo inserire movimenti per la propria officina
DROP POLICY IF EXISTS movimenti_staff_insert ON movimenti;
CREATE POLICY movimenti_staff_insert ON movimenti FOR INSERT TO authenticated
  WITH CHECK (officina_id IN (
    SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true
  ));

-- Staff puo modificare/eliminare movimenti della propria officina
DROP POLICY IF EXISTS movimenti_staff_update ON movimenti;
CREATE POLICY movimenti_staff_update ON movimenti FOR UPDATE TO authenticated
  USING (officina_id IN (
    SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true
  ));

DROP POLICY IF EXISTS movimenti_staff_delete ON movimenti;
CREATE POLICY movimenti_staff_delete ON movimenti FOR DELETE TO authenticated
  USING (officina_id IN (
    SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true
  ));

-- Abilita realtime per aggiornamenti live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'movimenti'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE movimenti';
  END IF;
END $$;
