-- ============================================
-- OfficinAI - Migrazione 034
-- Revisione (Gianni) / Centraline (Daniele) in lavorazione: oggi questi
-- movimenti si registravano solo a lavoro finito, con importo e spese
-- lavorazione gia' noti. Serve poterli segnare "in lavorazione" appena
-- iniziati (solo la descrizione, es. "scatola sterzo"), per poter gia'
-- caricare i ricambi comprati nel frattempo, e completarli dopo quando
-- si conoscono i numeri finali.
--
-- "stato" resta null per tutti gli altri tipi di movimento, che non hanno
-- questo stato intermedio. "ricambi_acquistati" e' lo stesso meccanismo
-- di appuntamenti.ricambi_acquistati (migrazione 033), qui sui movimenti.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS stato text;
ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS ricambi_acquistati jsonb DEFAULT '[]';

NOTIFY pgrst, 'reload schema';
