-- ============================================
-- OfficinAI - Migrazione 009
-- Tabella recensioni clienti
-- ============================================

CREATE TABLE IF NOT EXISTS recensioni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appuntamento_id UUID REFERENCES appuntamenti(id) NOT NULL,
  officina_id UUID REFERENCES officine(id) NOT NULL,
  cliente_id UUID REFERENCES clienti(id) NOT NULL,
  voto INTEGER NOT NULL CHECK (voto >= 1 AND voto <= 5),
  commento TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Un solo voto per appuntamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_recensioni_appuntamento ON recensioni(appuntamento_id);

-- RLS
ALTER TABLE recensioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recensioni_select" ON recensioni
  FOR SELECT USING (true);

CREATE POLICY "recensioni_insert" ON recensioni
  FOR INSERT WITH CHECK (true);
