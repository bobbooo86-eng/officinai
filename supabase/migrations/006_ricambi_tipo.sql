-- ============================================
-- OfficinAI - Migrazione 006
-- Aggiunge colonna 'tipo' a ricambi_usati (nuovo/usato)
-- ============================================

ALTER TABLE ricambi_usati
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'usato'
  CHECK (tipo IN ('nuovo', 'usato', 'consumabile'));
