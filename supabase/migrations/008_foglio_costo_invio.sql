-- ============================================
-- OfficinAI - Migrazione 008
-- Aggiunge costo manodopera, tariffa, e invio cliente
-- ============================================

ALTER TABLE foglio_lavoro
  ADD COLUMN IF NOT EXISTS costo_manodopera NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tariffa_oraria NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS inviato_al_cliente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_invio_cliente TIMESTAMPTZ;
