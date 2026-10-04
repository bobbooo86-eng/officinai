-- ============================================
-- OfficinAI - Migrazione 030
-- Saldo di partenza per ciascun fornitore di ricambi (Autoricambi,
-- Autodemolizioni Monti): serve a far partire il conto fornitori da un
-- debito/credito reale già esistente prima di usare questa funzione,
-- invece che sempre da zero. Un semplice JSON { autoricambi, monti } sulla
-- riga dell'officina, non una tabella a parte: sono solo due numeri.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE officine ADD COLUMN IF NOT EXISTS saldi_fornitori_ricambi jsonb DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
