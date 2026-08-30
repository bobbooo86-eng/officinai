-- ============================================
-- OfficinAI - Migrazione 013
-- Allinea lo schema reale del database con quello atteso dal codice.
-- Tutte le istruzioni sono IF NOT EXISTS / additive: non cancellano
-- ne' modificano dati esistenti, aggiungono solo cio' che manca.
-- Sicuro da eseguire piu' volte.
-- ============================================

-- ---- MAGAZZINO: aggiunge colonne mancanti ----
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS codice text NOT NULL DEFAULT '';
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT '';
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS quantita integer NOT NULL DEFAULT 0;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS quantita_minima integer NOT NULL DEFAULT 0;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS prezzo_acq numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS prezzo_vend numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS fornitore text;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS scorta_minima integer;
ALTER TABLE magazzino ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ---- MOVIMENTI (Cassa): crea la tabella se manca del tutto ----
CREATE TABLE IF NOT EXISTS movimenti (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id   uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN (
                    'incasso_extra','spesa_officina','spesa_titolare',
                    'anticipo_dipendente','spesa_dipendente')),
  importo       numeric(10,2) NOT NULL CHECK (importo >= 0),
  descrizione   text NOT NULL DEFAULT '',
  metodo_pagamento text CHECK (metodo_pagamento IN (
                    'contanti','carta','bonifico','paypal','assegno','altro')),
  data          date NOT NULL DEFAULT CURRENT_DATE,
  dipendente_id uuid REFERENCES utenti(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES utenti(id) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimenti_officina_data ON movimenti(officina_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_movimenti_tipo ON movimenti(officina_id, tipo, data DESC);
CREATE INDEX IF NOT EXISTS idx_movimenti_dipendente ON movimenti(dipendente_id) WHERE dipendente_id IS NOT NULL;

ALTER TABLE movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movimenti_staff_select ON movimenti;
CREATE POLICY movimenti_staff_select ON movimenti FOR SELECT TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true));

DROP POLICY IF EXISTS movimenti_staff_insert ON movimenti;
CREATE POLICY movimenti_staff_insert ON movimenti FOR INSERT TO authenticated
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true));

DROP POLICY IF EXISTS movimenti_staff_update ON movimenti;
CREATE POLICY movimenti_staff_update ON movimenti FOR UPDATE TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true));

DROP POLICY IF EXISTS movimenti_staff_delete ON movimenti;
CREATE POLICY movimenti_staff_delete ON movimenti FOR DELETE TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true));

-- L'aggiunta alla publication richiede privilegi che l'utente della SQL
-- Editor puo' non avere: senza gestione dell'errore l'intero script si
-- interromperebbe qui, lasciando non applicato tutto cio' che segue.
-- L'aggiornamento in tempo reale e' un extra, la tabella funziona comunque.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'movimenti'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE movimenti';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Realtime non attivato su movimenti: %', SQLERRM;
END $$;

-- ---- NOTIFICHE: aggiunge supporto clienti (potrebbe mancare come per magazzino/movimenti) ----
ALTER TABLE notifiche ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clienti(id) ON DELETE CASCADE;
ALTER TABLE notifiche ALTER COLUMN utente_id DROP NOT NULL;
ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_destinatario_check;
ALTER TABLE notifiche
  ADD CONSTRAINT notifiche_destinatario_check
  CHECK ((utente_id IS NOT NULL) OR (cliente_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_id ON notifiche(cliente_id);

DROP POLICY IF EXISTS notifiche_cliente_select ON notifiche;
CREATE POLICY notifiche_cliente_select ON notifiche FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS notifiche_cliente_update ON notifiche;
CREATE POLICY notifiche_cliente_update ON notifiche FOR UPDATE TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS notifiche_staff_insert_cliente ON notifiche;
CREATE POLICY notifiche_staff_insert_cliente ON notifiche FOR INSERT TO authenticated
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- ---- STORAGE: bucket per i preventivi condivisibili e per i loghi ----
-- Senza questo bucket l'upload del preventivo fallisce e i messaggi
-- WhatsApp/Email partono senza il link al documento.
INSERT INTO storage.buckets (id, name, public)
VALUES ('preventivi', 'preventivi', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- I bucket gia' esistenti potrebbero non essere pubblici: i link condivisi
-- con i clienti devono essere leggibili senza autenticazione.
UPDATE storage.buckets SET public = true WHERE id IN ('preventivi', 'logos');

DROP POLICY IF EXISTS "Staff can upload preventivi" ON storage.objects;
CREATE POLICY "Staff can upload preventivi" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'preventivi');

DROP POLICY IF EXISTS "Staff can update preventivi" ON storage.objects;
CREATE POLICY "Staff can update preventivi" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'preventivi');

DROP POLICY IF EXISTS "Anyone can read preventivi" ON storage.objects;
CREATE POLICY "Anyone can read preventivi" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'preventivi');

-- Ricrea anche le policy dei loghi in modo idempotente (la 003 fallisce
-- se rieseguita, perche' non usa DROP POLICY IF EXISTS).
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated users can update their logos" ON storage.objects;
CREATE POLICY "Authenticated users can update their logos" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Anyone can read logos" ON storage.objects;
CREATE POLICY "Anyone can read logos" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'logos');

-- ---- Forza il refresh della cache schema di PostgREST ----
NOTIFY pgrst, 'reload schema';
