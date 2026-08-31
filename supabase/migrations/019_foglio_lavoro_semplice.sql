-- Campi per la scheda di lavoro semplificata: lavorazioni tipiche
-- selezionate a crocetta, lavorazioni libere da eseguire, nome
-- dell'operaio (distinto da firma_operaio, che gia' esisteva ed e'
-- rimasta la firma). Idempotente.
ALTER TABLE foglio_lavoro ADD COLUMN IF NOT EXISTS lavorazioni_tipiche text[] DEFAULT '{}';
ALTER TABLE foglio_lavoro ADD COLUMN IF NOT EXISTS lavorazioni_da_eseguire text;
ALTER TABLE foglio_lavoro ADD COLUMN IF NOT EXISTS nome_operaio text;

NOTIFY pgrst, 'reload schema';
