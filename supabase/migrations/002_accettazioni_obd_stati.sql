-- ============================================
-- OfficinAI - Migrazione 002
-- Aggiunge: accettazioni, scansioni_obd, nuovi stati appuntamento
-- ============================================

-- ============================================
-- SEZIONE 1: Aggiorna enum stato_appuntamento
-- Aggiungi 'richiesta' e 'annullato'
-- ============================================

-- Aggiungi 'richiesta' (primo stato del flusso)
DO $$ BEGIN
  ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'richiesta' BEFORE 'prenotato';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Aggiungi 'annullato' (stato finale)
DO $$ BEGIN
  ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'annullato' AFTER 'pronto';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- SEZIONE 2: Tabella accettazioni
-- Scheda accettazione veicolo con danni, checklist, firma
-- ============================================

CREATE TABLE IF NOT EXISTS accettazioni (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id     uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  km_ingresso         integer NOT NULL DEFAULT 0,
  livello_carburante  integer NOT NULL DEFAULT 50,
  danni               jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist           jsonb NOT NULL DEFAULT '{}'::jsonb,
  oggetti_personali   text NOT NULL DEFAULT '',
  note_accettazione   text NOT NULL DEFAULT '',
  firma_cliente       text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT accettazioni_carburante_check CHECK (livello_carburante >= 0 AND livello_carburante <= 100),
  CONSTRAINT accettazioni_km_check CHECK (km_ingresso >= 0)
);

-- Indice univoco: una sola accettazione per appuntamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_accettazioni_appuntamento
  ON accettazioni(appuntamento_id);

-- Indice per query rapide
CREATE INDEX IF NOT EXISTS idx_accettazioni_created
  ON accettazioni(created_at DESC);

-- ============================================
-- SEZIONE 3: Tabella scansioni_obd
-- Scansioni OBD inviate dai clienti
-- ============================================

CREATE TABLE IF NOT EXISTS scansioni_obd (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id   uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  cliente_id    uuid NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  veicolo_id    uuid NOT NULL REFERENCES veicoli(id) ON DELETE CASCADE,
  codici        text[] NOT NULL DEFAULT '{}',
  km_scansione  integer,
  nota_cliente  text,
  letto         boolean NOT NULL DEFAULT false,
  gestito       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_scansioni_obd_officina
  ON scansioni_obd(officina_id, gestito, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scansioni_obd_veicolo
  ON scansioni_obd(veicolo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scansioni_obd_cliente
  ON scansioni_obd(cliente_id, created_at DESC);

-- ============================================
-- SEZIONE 4: RLS (Row Level Security)
-- ============================================

ALTER TABLE accettazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE scansioni_obd ENABLE ROW LEVEL SECURITY;

-- ACCETTAZIONI: staff dell'officina legge/scrive tramite appuntamento
CREATE POLICY "accettazioni_staff_select" ON accettazioni
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = accettazioni.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

CREATE POLICY "accettazioni_staff_insert" ON accettazioni
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = accettazioni.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

CREATE POLICY "accettazioni_staff_update" ON accettazioni
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = accettazioni.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- Il cliente vede la propria accettazione
CREATE POLICY "accettazioni_cliente_select" ON accettazioni
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = accettazioni.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- SCANSIONI OBD: staff dell'officina legge/aggiorna
CREATE POLICY "scansioni_obd_staff_select" ON scansioni_obd
  FOR SELECT TO authenticated
  USING (officina_id = get_user_officina_id());

CREATE POLICY "scansioni_obd_staff_update" ON scansioni_obd
  FOR UPDATE TO authenticated
  USING (officina_id = get_user_officina_id());

-- Il cliente inserisce le proprie scansioni
CREATE POLICY "scansioni_obd_cliente_insert" ON scansioni_obd
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id = get_client_id());

-- Il cliente vede le proprie scansioni
CREATE POLICY "scansioni_obd_cliente_select" ON scansioni_obd
  FOR SELECT TO authenticated
  USING (cliente_id = get_client_id());

-- ============================================
-- SEZIONE 5: Trigger per notifiche
-- Quando arriva una nuova scansione OBD, crea notifica per l'officina
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_obd_scan()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notifiche (officina_id, tipo, titolo, messaggio)
  VALUES (
    NEW.officina_id,
    'obd_scan',
    'Nuova scansione OBD',
    'Un cliente ha inviato una scansione con ' || array_length(NEW.codici, 1) || ' codici errore'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_obd_scan ON scansioni_obd;
CREATE TRIGGER trg_new_obd_scan
  AFTER INSERT ON scansioni_obd
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_obd_scan();

-- ============================================
-- SEZIONE 6: Realtime
-- Abilita le subscription per scansioni in tempo reale
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE scansioni_obd;
