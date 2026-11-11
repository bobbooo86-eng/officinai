-- ============================================
-- OfficinAI - Migrazione 043
-- Pannello riservato per vedere tutte le nuove registrazioni di
-- officine (piano, stato abbonamento, contatti). Riusa la colonna
-- utenti.is_admin, gia' presente nel database ma mai usata da nessun
-- codice tracciato: ora diventa il flag "vede tutte le officine, non
-- solo la propria".
-- ============================================

UPDATE utenti SET is_admin = true WHERE email = 'benci1991@tiscali.it';

-- Un amministratore vede l'elenco di TUTTE le officine e i relativi
-- abbonamenti, oltre alla propria (gia' garantita dalle policy
-- "_staff" esistenti). Nota bene: la sottoquery legge "utenti", che ha
-- RLS disattivata in questo momento (vedi migrazione 041) — quindi qui
-- non c'e' il problema di auto-riferimento incontrato con la 040: e'
-- lo stesso pattern gia' sicuro usato per tutte le altre policy
-- "officina_id IN (SELECT ... FROM utenti ...)".
DROP POLICY IF EXISTS officine_admin_select ON officine;
CREATE POLICY officine_admin_select ON officine FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

DROP POLICY IF EXISTS abbonamenti_admin_select ON abbonamenti;
CREATE POLICY abbonamenti_admin_select ON abbonamenti FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true));

NOTIFY pgrst, 'reload schema';
