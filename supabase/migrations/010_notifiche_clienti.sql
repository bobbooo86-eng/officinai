-- ============================================
-- OfficinAI - Migrazione 010
-- Estende la tabella notifiche per supportare anche i clienti
-- (oltre agli utenti staff).
-- ============================================

-- 1) Aggiunge colonna cliente_id (FK verso clienti, nullable)
ALTER TABLE notifiche
  ADD COLUMN IF NOT EXISTS cliente_id uuid
    REFERENCES clienti(id) ON DELETE CASCADE;

-- 2) Rende utente_id nullable (serve quando il destinatario è un cliente)
ALTER TABLE notifiche ALTER COLUMN utente_id DROP NOT NULL;

-- 3) Vincolo di integrità: almeno uno dei due destinatari deve essere valorizzato
ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_destinatario_check;
ALTER TABLE notifiche
  ADD CONSTRAINT notifiche_destinatario_check
  CHECK ((utente_id IS NOT NULL) OR (cliente_id IS NOT NULL));

-- 4) Indici per query veloce lato cliente
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_id ON notifiche(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_letto ON notifiche(cliente_id, letto);

-- 5) RLS: permetti al cliente di leggere le proprie notifiche
DROP POLICY IF EXISTS notifiche_cliente_select ON notifiche;
CREATE POLICY notifiche_cliente_select ON notifiche FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
  ));

-- 6) RLS: permetti al cliente di marcare come letta la propria notifica
DROP POLICY IF EXISTS notifiche_cliente_update ON notifiche;
CREATE POLICY notifiche_cliente_update ON notifiche FOR UPDATE TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
  ));

-- 7) RLS: permetti all'officina di inserire notifiche per i propri clienti
DROP POLICY IF EXISTS notifiche_staff_insert_cliente ON notifiche;
CREATE POLICY notifiche_staff_insert_cliente ON notifiche FOR INSERT TO authenticated
  WITH CHECK (
    officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  );
