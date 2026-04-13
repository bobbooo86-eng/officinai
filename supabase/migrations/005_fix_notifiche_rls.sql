-- ============================================
-- OfficinAI - Migrazione 005
-- Fix RLS notifiche: utente_id è utenti.id, NON auth.uid()
-- Usa auth.jwt()->>'email' per mappare auth user → utenti.id
-- (authenticated role non può accedere a auth.users direttamente)
-- ============================================

-- Fix SELECT policy
DROP POLICY IF EXISTS notifiche_staff_select ON notifiche;
CREATE POLICY notifiche_staff_select ON notifiche FOR SELECT TO authenticated
  USING (utente_id IN (
    SELECT id FROM utenti WHERE email = auth.jwt()->>'email'
  ));

-- Fix UPDATE policy (per segnare come letto)
DROP POLICY IF EXISTS notifiche_staff_update ON notifiche;
CREATE POLICY notifiche_staff_update ON notifiche FOR UPDATE TO authenticated
  USING (utente_id IN (
    SELECT id FROM utenti WHERE email = auth.jwt()->>'email'
  ));
