-- ============================================
-- OfficinAI - Migrazione 046
-- Cancellazione VERA e definitiva di un'officina, richiamabile solo dal
-- pannello amministratore e solo su un'officina gia' archiviata (doppio
-- passaggio deliberato: prima archivia, poi — se davvero non serve
-- piu' — elimina per sempre). Non reversibile: a differenza
-- dell'archiviazione, qui i dati vengono davvero rimossi da ogni
-- tabella collegata, in una singola transazione.
--
-- Fatta come funzione SQL (SECURITY DEFINER) invece che con tante
-- policy DELETE lato client: piu' sicura (un solo punto da rivedere,
-- un controllo esplicito che chi chiama sia admin, tutto o niente in
-- una transazione) e non richiede di aprire il permesso di cancellare
-- a mano appuntamenti/clienti/fatture da nessun'altra parte dell'app.
-- ============================================

CREATE OR REPLACE FUNCTION elimina_officina_definitivamente(p_officina_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_archiviata boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM utenti WHERE email = auth.jwt()->>'email' AND is_admin = true LIMIT 1;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Non autorizzato.';
  END IF;

  SELECT archiviata INTO v_archiviata FROM officine WHERE id = p_officina_id;
  IF v_archiviata IS NOT TRUE THEN
    RAISE EXCEPTION 'L''officina va prima archiviata.';
  END IF;

  DELETE FROM difetti WHERE foglio_lavoro_id IN (
    SELECT fl.id FROM foglio_lavoro fl JOIN appuntamenti a ON a.id = fl.appuntamento_id WHERE a.officina_id = p_officina_id
  );
  DELETE FROM ricambi_usati WHERE foglio_lavoro_id IN (
    SELECT fl.id FROM foglio_lavoro fl JOIN appuntamenti a ON a.id = fl.appuntamento_id WHERE a.officina_id = p_officina_id
  );
  DELETE FROM foto WHERE appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);
  DELETE FROM messaggi WHERE appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);
  DELETE FROM accettazioni WHERE appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);
  DELETE FROM preventivi WHERE appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);
  DELETE FROM foglio_lavoro WHERE appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);

  DELETE FROM notifiche_scadenze_inviate WHERE veicolo_id IN (
    SELECT v.id FROM veicoli v JOIN clienti c ON c.id = v.cliente_id WHERE c.officina_id = p_officina_id
  );
  DELETE FROM whatsapp_inviati WHERE
    cliente_id IN (SELECT id FROM clienti WHERE officina_id = p_officina_id)
    OR appuntamento_id IN (SELECT id FROM appuntamenti WHERE officina_id = p_officina_id);
  DELETE FROM veicoli WHERE cliente_id IN (SELECT id FROM clienti WHERE officina_id = p_officina_id);

  DELETE FROM recensioni WHERE officina_id = p_officina_id;
  DELETE FROM fatture WHERE officina_id = p_officina_id;
  DELETE FROM movimenti WHERE officina_id = p_officina_id;
  DELETE FROM acquisti_fornitori_ricambi WHERE officina_id = p_officina_id;
  DELETE FROM notifiche_wa WHERE officina_id = p_officina_id;
  DELETE FROM notifiche WHERE officina_id = p_officina_id;
  DELETE FROM scansioni_obd WHERE officina_id = p_officina_id;
  DELETE FROM schede_lavoro WHERE officina_id = p_officina_id;
  DELETE FROM magazzino WHERE officina_id = p_officina_id;
  DELETE FROM casi_ai WHERE officina_id = p_officina_id;
  DELETE FROM promemoria_nascosti WHERE officina_id = p_officina_id;
  DELETE FROM promemoria_personali WHERE officina_id = p_officina_id;
  DELETE FROM inviti_staff WHERE officina_id = p_officina_id;
  DELETE FROM impostazioni_email WHERE officina_id = p_officina_id;

  DELETE FROM appuntamenti WHERE officina_id = p_officina_id;
  DELETE FROM clienti WHERE officina_id = p_officina_id;
  DELETE FROM abbonamenti WHERE officina_id = p_officina_id;
  DELETE FROM pagamenti WHERE officina_id = p_officina_id;
  DELETE FROM utenti WHERE officina_id = p_officina_id;

  DELETE FROM officine WHERE id = p_officina_id;
END;
$$;

GRANT EXECUTE ON FUNCTION elimina_officina_definitivamente(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
