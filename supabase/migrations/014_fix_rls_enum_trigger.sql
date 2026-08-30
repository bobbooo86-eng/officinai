-- ============================================
-- OfficinAI - Migrazione 014
-- Corregge le cause per cui molti salvataggi falliscono:
--  1. le funzioni RLS cercavano utenti/clienti tramite auth_id, che non
--     viene mai valorizzato dal codice di registrazione;
--  2. lo stato 'consegnato' usato dall'app non esiste nell'enum;
--  3. un trigger legge una colonna inesistente e fa fallire ogni
--     richiesta di appuntamento inviata dai clienti;
--  4. mancano alcune colonne e tabelle scritte dall'app.
-- Additiva e idempotente: non cancella ne' modifica dati esistenti.
-- ============================================

-- ---- 1. Funzioni RLS: risolvono anche tramite email del JWT ----
-- auth_id resta supportato, ma da solo restituiva sempre NULL e quindi
-- ogni policy che lo usa negava lettura e scrittura.
CREATE OR REPLACE FUNCTION get_user_officina_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT officina_id
  FROM utenti
  WHERE (auth_id = auth.uid() OR email = auth.jwt()->>'email')
    AND attivo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM clienti
  WHERE auth_id = auth.uid() OR email = auth.jwt()->>'email'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_client_officina_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT officina_id
  FROM clienti
  WHERE auth_id = auth.uid() OR email = auth.jwt()->>'email'
  LIMIT 1;
$$;

-- ---- 2. Trigger richieste appuntamento ----
-- Leggeva NEW.note, che su appuntamenti non esiste: l'errore faceva
-- abortire l'INSERT, quindi nessun cliente riusciva a prenotare.
CREATE OR REPLACE FUNCTION notify_new_richiesta()
RETURNS trigger AS $$
DECLARE
  r RECORD;
  v_cliente_nome TEXT;
BEGIN
  IF NEW.stato <> 'richiesta' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_cliente_nome FROM clienti WHERE id = NEW.cliente_id;

  FOR r IN SELECT id FROM utenti WHERE officina_id = NEW.officina_id
  LOOP
    INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      NEW.officina_id,
      r.id,
      'appuntamento',
      'Nuova richiesta appuntamento',
      COALESCE(v_cliente_nome, 'Un cliente') || ' ha richiesto un appuntamento' ||
        CASE WHEN NEW.problema IS NOT NULL AND NEW.problema <> ''
             THEN ': ' || LEFT(NEW.problema, 100) ELSE '' END,
      'appuntamento',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- 3. Colonne mancanti su appuntamenti ----
-- Usate da "proponi nuova data" e dalla registrazione del pagamento
-- alla consegna: senza di esse quelle operazioni venivano rifiutate.
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS data_proposta timestamptz;
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS nota_officina text;
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS pagamento jsonb;

-- ---- 4. Vincolo di unicita' sulle email dello staff ----
-- L'onboarding usa upsert(onConflict: 'email'), che senza indice unico
-- fallisce con errore 42P10 e perde i membri del team inseriti.
CREATE UNIQUE INDEX IF NOT EXISTS utenti_email_unique ON utenti (email);

-- ---- 5. Tabelle scritte dall'app ma mai create ----
CREATE TABLE IF NOT EXISTS contatti_landing (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  telefono   text,
  officina   text,
  messaggio  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contatti_landing ENABLE ROW LEVEL SECURITY;

-- Il modulo contatti e' pubblico: chiunque puo' inviarlo, nessuno puo'
-- rileggerlo dal client (i lead si consultano dalla dashboard Supabase).
DROP POLICY IF EXISTS contatti_landing_insert_pubblico ON contatti_landing;
CREATE POLICY contatti_landing_insert_pubblico ON contatti_landing
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS impostazioni_email (
  officina_id uuid PRIMARY KEY REFERENCES officine(id) ON DELETE CASCADE,
  impostazioni jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE impostazioni_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impostazioni_email_staff_all ON impostazioni_email;
CREATE POLICY impostazioni_email_staff_all ON impostazioni_email
  FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email' AND attivo = true));

-- ---- 6. Foto lavorazione: bucket leggibile e policy allineata ai path ----
-- Il codice carica su "{appuntamento_id}/..." e legge con getPublicUrl,
-- mentre il bucket era privato con una policy che imponeva officina_id.
UPDATE storage.buckets SET public = true WHERE id = 'foto-lavorazione';

DROP POLICY IF EXISTS staff_upload_foto ON storage.objects;
CREATE POLICY staff_upload_foto ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'foto-lavorazione');

DROP POLICY IF EXISTS staff_update_foto ON storage.objects;
CREATE POLICY staff_update_foto ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'foto-lavorazione');

DROP POLICY IF EXISTS leggi_foto ON storage.objects;
CREATE POLICY leggi_foto ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'foto-lavorazione');

NOTIFY pgrst, 'reload schema';
