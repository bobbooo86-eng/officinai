-- fatture ha RLS attivo con policy per SELECT/INSERT/UPDATE (verificato via
-- Management API) ma nessuna per DELETE: senza una policy esplicita, ogni
-- DELETE viene filtrato silenziosamente (0 righe, nessun errore), e la
-- cancellazione del preventivo collegato falliva poi per il vincolo
-- fatture_preventivo_id_fkey, con un errore che sembrava un bug del tasto
-- "Elimina" invece che una policy mancante.
-- DROP/CREATE invece di "IF NOT EXISTS" (che CREATE POLICY non supporta):
-- questo file viene rieseguito ad ogni deploy, deve restare ripetibile.
DROP POLICY IF EXISTS "Users can delete own officina fatture" ON fatture;
CREATE POLICY "Users can delete own officina fatture" ON fatture
  FOR DELETE
  USING (
    officina_id IN (
      SELECT utenti.officina_id FROM utenti WHERE utenti.email = (auth.jwt() ->> 'email'::text)
    )
  );

NOTIFY pgrst, 'reload schema';
