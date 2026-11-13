-- ============================================
-- OfficinAI - Migrazione 047
-- Richiude il buco lasciato dall'incidente della 040/041: la tabella
-- utenti (staff) era rimasta senza RLS perche' la policy originale
-- faceva riferimento a se stessa, bloccando tutto. Questa volta si usa
-- il pattern standard per evitare l'auto-riferimento: due funzioni
-- SECURITY DEFINER che leggono utenti bypassando la RLS (i proprietari
-- di tabella in Postgres la bypassano sempre, a meno di FORCE ROW
-- LEVEL SECURITY, mai impostato qui), cosi' le policy che le usano non
-- innescano mai la ricorsione.
-- ============================================

-- Officina dell'utente attualmente autenticato, bypassando la RLS.
CREATE OR REPLACE FUNCTION mia_officina_id()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email';
$$;

-- Se un'officina ha gia' almeno un utente, senza rivelare quali
-- (nessuna riga vera restituita: solo true/false). Serve alle pagine
-- di auto-registrazione, che scrivono su utenti prima che esista una
-- sessione autenticata e quindi non possono leggere la tabella.
CREATE OR REPLACE FUNCTION officina_ha_gia_utenti(p_officina_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM utenti WHERE officina_id = p_officina_id);
$$;

GRANT EXECUTE ON FUNCTION mia_officina_id() TO authenticated;
GRANT EXECUTE ON FUNCTION officina_ha_gia_utenti(uuid) TO anon, authenticated;

ALTER TABLE utenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS utenti_staff ON utenti;
CREATE POLICY utenti_staff ON utenti FOR ALL TO authenticated
  USING (officina_id IN (SELECT mia_officina_id()))
  WITH CHECK (officina_id IN (SELECT mia_officina_id()));

-- Stesso significato di prima (attivo=false, oppure primo titolare di
-- un'officina che non ha ancora nessuno), ma il controllo "esiste gia'
-- un utente in questa officina?" ora passa dalla funzione che bypassa
-- la RLS, invece di una sottoquery diretta su utenti che un ruolo anon
-- non potrebbe comunque leggere (tornerebbe sempre vuota, rendendo il
-- controllo inutile e riaprendo l'auto-concessione di accesso attivo
-- su un'officina altrui che questa policy doveva impedire).
DROP POLICY IF EXISTS utenti_anon_insert ON utenti;
CREATE POLICY utenti_anon_insert ON utenti FOR INSERT TO anon
  WITH CHECK (
    attivo = false
    OR (ruolo = 'titolare' AND NOT officina_ha_gia_utenti(officina_id))
  );

DROP POLICY IF EXISTS utenti_auth_insert_join ON utenti;
CREATE POLICY utenti_auth_insert_join ON utenti FOR INSERT TO authenticated
  WITH CHECK (
    attivo = false
    OR (ruolo = 'titolare' AND NOT officina_ha_gia_utenti(officina_id))
  );

NOTIFY pgrst, 'reload schema';
