-- ============================================
-- OfficinAI - Migrazione 007
-- Aggiunge firma_operaio al foglio_lavoro
-- ============================================

ALTER TABLE foglio_lavoro
  ADD COLUMN IF NOT EXISTS firma_operaio TEXT;
