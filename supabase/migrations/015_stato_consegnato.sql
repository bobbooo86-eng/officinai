-- ============================================
-- OfficinAI - Migrazione 015
-- Aggiunge lo stato 'consegnato' all'enum stato_appuntamento.
--
-- L'app lo usa gia' ovunque (consegna del veicolo, crediti, conteggio
-- lavori fatturati), ma non esisteva nel database: marcare un lavoro come
-- consegnato falliva sempre con errore 22P02, quindi nessun appuntamento
-- poteva essere chiuso.
--
-- Sta in un file separato perche' un valore aggiunto a un enum non e'
-- utilizzabile nella stessa transazione in cui viene creato.
-- ============================================

DO $$ BEGIN
  ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'consegnato' AFTER 'pronto';
EXCEPTION WHEN others THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
