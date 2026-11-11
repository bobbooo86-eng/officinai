-- ============================================
-- OfficinAI - Migrazione 045
-- Archiviazione officine dal pannello amministratore, stessa logica
-- gia' usata per i clienti (021_clienti_archiviazione.sql): un'officina
-- possiede appuntamenti/clienti/fatture/movimenti reali, una vera
-- cancellazione sarebbe irreversibile e rischiosa da un pannello.
-- "Elimina" quindi archivia (nascosta dall'elenco, ripristinabile), mai
-- una DELETE vera.
-- ============================================

ALTER TABLE officine ADD COLUMN IF NOT EXISTS archiviata boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
