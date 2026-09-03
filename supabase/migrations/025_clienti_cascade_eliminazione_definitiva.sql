-- Permette una vera eliminazione definitiva di un cliente archiviato,
-- senza lasciare righe orfane. Prima di questa migrazione, cancellare un
-- cliente falliva sempre se aveva anche un solo appuntamento o una
-- recensione (appuntamenti_cliente_id_fkey e recensioni_cliente_id_fkey
-- erano NO ACTION, non CASCADE) — per questo "Elimina" e' diventato
-- "Archivia" (migrazione 021). Ora che serve anche una cancellazione
-- vera e propria (su richiesta esplicita, dall'elenco "Clienti
-- archiviati"), tutto l'albero di chiavi esterne partendo da clienti va
-- a CASCADE in modo coerente, altrimenti la cancellazione si fermerebbe
-- comunque un livello piu' in basso (es. su una fattura collegata).
--
-- Verificato via introspezione diretta (Management API) l'intero grafo
-- delle foreign key che puntano a clienti/appuntamenti/veicoli/preventivi:
-- questi sei vincoli erano NO ACTION, tutti gli altri erano gia' CASCADE
-- o SET NULL.

ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_cliente_id_fkey;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE;

ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_veicolo_id_fkey;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_veicolo_id_fkey
  FOREIGN KEY (veicolo_id) REFERENCES veicoli(id) ON DELETE CASCADE;

ALTER TABLE recensioni DROP CONSTRAINT IF EXISTS recensioni_appuntamento_id_fkey;
ALTER TABLE recensioni ADD CONSTRAINT recensioni_appuntamento_id_fkey
  FOREIGN KEY (appuntamento_id) REFERENCES appuntamenti(id) ON DELETE CASCADE;

ALTER TABLE recensioni DROP CONSTRAINT IF EXISTS recensioni_cliente_id_fkey;
ALTER TABLE recensioni ADD CONSTRAINT recensioni_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE;

ALTER TABLE fatture DROP CONSTRAINT IF EXISTS fatture_appuntamento_id_fkey;
ALTER TABLE fatture ADD CONSTRAINT fatture_appuntamento_id_fkey
  FOREIGN KEY (appuntamento_id) REFERENCES appuntamenti(id) ON DELETE CASCADE;

ALTER TABLE fatture DROP CONSTRAINT IF EXISTS fatture_preventivo_id_fkey;
ALTER TABLE fatture ADD CONSTRAINT fatture_preventivo_id_fkey
  FOREIGN KEY (preventivo_id) REFERENCES preventivi(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
