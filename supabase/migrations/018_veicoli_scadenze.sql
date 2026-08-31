-- Aggiunge la colonna per le scadenze (revisione, tagliando, assicurazione,
-- bollo) sul veicolo. src/types/database.ts la aveva gia' definita nel tipo
-- Veicolo, ma non era mai stata creata sul database reale: idempotente,
-- sicura da rieseguire.
ALTER TABLE veicoli ADD COLUMN IF NOT EXISTS scadenze jsonb;

NOTIFY pgrst, 'reload schema';
