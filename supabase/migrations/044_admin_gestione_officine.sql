-- ============================================
-- OfficinAI - Migrazione 044
-- Estende il pannello amministratore: gestione manuale dell'abbonamento
-- (attiva/sospendi/estendi), nota privata per officina, e visibilità dei
-- dati necessari per il dettaglio di una singola officina (titolare,
-- numero di clienti/veicoli/appuntamenti).
-- ============================================

ALTER TABLE officine ADD COLUMN IF NOT EXISTS note_admin text;

-- L'admin puo' modificare i dati dell'officina (per ora solo la nota
-- interna, via l'interfaccia del pannello).
DROP POLICY IF EXISTS officine_admin_update ON officine;
CREATE POLICY officine_admin_update ON officine FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

-- L'admin puo' anche scrivere l'abbonamento (attivare/sospendere/
-- estendere a mano, bypassando Stripe), non solo leggerlo.
DROP POLICY IF EXISTS abbonamenti_admin_select ON abbonamenti;
DROP POLICY IF EXISTS abbonamenti_admin_write ON abbonamenti;
CREATE POLICY abbonamenti_admin_write ON abbonamenti FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

-- Sola lettura per i contatori nel dettaglio di un'officina.
DROP POLICY IF EXISTS clienti_admin_select ON clienti;
CREATE POLICY clienti_admin_select ON clienti FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

DROP POLICY IF EXISTS veicoli_admin_select ON veicoli;
CREATE POLICY veicoli_admin_select ON veicoli FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

DROP POLICY IF EXISTS appuntamenti_admin_select ON appuntamenti;
CREATE POLICY appuntamenti_admin_select ON appuntamenti FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

NOTIFY pgrst, 'reload schema';
