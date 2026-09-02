-- appuntamenti_cliente_id_fkey e recensioni_cliente_id_fkey non hanno
-- ON DELETE CASCADE (verificato via Management API): cancellare un
-- cliente con anche un solo appuntamento o una recensione veniva
-- rifiutato dal database, ma l'app ignorava l'errore e mostrava
-- "eliminato" comunque -- il cliente tornava al primo aggiornamento
-- della pagina. Cancellare in cascata perderebbe pero' tutto lo
-- storico lavori/preventivi/fatture del cliente: invece di forzare la
-- cancellazione, "elimina" ora archivia (nascosto dalla lista, ma
-- ripristinabile), coerente con "ogni cosa deve poter essere
-- ripristinata".
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS attivo boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
