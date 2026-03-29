-- ============================================
-- OfficinAI - Migrazione 001: Tabelle, RLS e Indici
-- Isolamento multi-tenant per officine meccaniche
-- ============================================

-- ============================================
-- SEZIONE 1: Tipi enumerati
-- ============================================

DO $$ BEGIN
  CREATE TYPE ruolo_utente AS ENUM ('titolare', 'operaio', 'reception');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stato_appuntamento AS ENUM ('prenotato', 'in_diagnosi', 'in_lavorazione', 'attesa_ricambi', 'pronto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stato_preventivo AS ENUM ('bozza', 'inviato', 'accettato', 'rifiutato');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE categoria_foto AS ENUM ('prima', 'durante', 'dopo', 'difetto', 'ricambio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gravita_difetto AS ENUM ('bassa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SEZIONE 2: Tabelle
-- ============================================

-- Officine: tabella principale per il multi-tenant
CREATE TABLE IF NOT EXISTS officine (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  indirizzo   text NOT NULL DEFAULT '',
  tel         text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  p_iva       text NOT NULL DEFAULT '',
  logo_url    text,
  piano       text NOT NULL DEFAULT 'base',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Utenti: staff dell'officina (titolare, operaio, reception)
CREATE TABLE IF NOT EXISTS utenti (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  auth_id     uuid UNIQUE,
  nome        text NOT NULL,
  email       text NOT NULL,
  tel         text NOT NULL DEFAULT '',
  ruolo       ruolo_utente NOT NULL DEFAULT 'operaio',
  avatar_url  text,
  attivo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Clienti: clienti dell'officina
CREATE TABLE IF NOT EXISTS clienti (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id     uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  auth_id         uuid UNIQUE,
  nome            text NOT NULL,
  tel             text NOT NULL DEFAULT '',
  email           text NOT NULL DEFAULT '',
  codice_fiscale  text,
  indirizzo       text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Veicoli: auto/moto associati ai clienti
CREATE TABLE IF NOT EXISTS veicoli (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  targa       text NOT NULL DEFAULT '',
  marca       text NOT NULL DEFAULT '',
  modello     text NOT NULL DEFAULT '',
  anno        integer,
  km          integer NOT NULL DEFAULT 0,
  carburante  text NOT NULL DEFAULT '',
  telaio      text,
  scadenze    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Appuntamenti: prenotazioni e lavori in corso
CREATE TABLE IF NOT EXISTS appuntamenti (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id   uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  cliente_id    uuid NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  veicolo_id    uuid NOT NULL REFERENCES veicoli(id) ON DELETE CASCADE,
  tecnico_id    uuid REFERENCES utenti(id) ON DELETE SET NULL,
  data_ora      timestamptz NOT NULL,
  stato         stato_appuntamento NOT NULL DEFAULT 'prenotato',
  problema      text NOT NULL DEFAULT '',
  operazioni    text,
  codici_obd    text,
  priorita      text NOT NULL DEFAULT 'normale',
  note_interne  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Preventivi: stime di costo per il cliente
CREATE TABLE IF NOT EXISTS preventivi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  righe           jsonb NOT NULL DEFAULT '[]',
  subtotale       numeric(10,2) NOT NULL DEFAULT 0,
  sconto          numeric(10,2) NOT NULL DEFAULT 0,
  iva             numeric(10,2) NOT NULL DEFAULT 0,
  totale          numeric(10,2) NOT NULL DEFAULT 0,
  stato           stato_preventivo NOT NULL DEFAULT 'bozza',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Foglio di lavoro: traccia tempo e attivita del tecnico
CREATE TABLE IF NOT EXISTS foglio_lavoro (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  tecnico_id      uuid NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  inizio          timestamptz,
  fine            timestamptz,
  tempo_lavoro_ms integer NOT NULL DEFAULT 0,
  pause           integer NOT NULL DEFAULT 0,
  km_uscita       integer,
  note_finali     text,
  chiuso          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Ricambi usati: pezzi utilizzati nel foglio di lavoro
CREATE TABLE IF NOT EXISTS ricambi_usati (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foglio_lavoro_id  uuid NOT NULL REFERENCES foglio_lavoro(id) ON DELETE CASCADE,
  nome              text NOT NULL,
  codice            text,
  quantita          integer NOT NULL DEFAULT 1,
  stato_rimosso     text,
  prezzo            numeric(10,2) NOT NULL DEFAULT 0,
  fornitore         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Difetti: problemi riscontrati durante la lavorazione
CREATE TABLE IF NOT EXISTS difetti (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foglio_lavoro_id  uuid NOT NULL REFERENCES foglio_lavoro(id) ON DELETE CASCADE,
  descrizione       text NOT NULL,
  gravita           gravita_difetto NOT NULL DEFAULT 'media',
  consigliato       text,
  foto_url          text,
  risolto           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Foto: documentazione fotografica per appuntamento
CREATE TABLE IF NOT EXISTS foto (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  url             text NOT NULL,
  categoria       categoria_foto NOT NULL DEFAULT 'durante',
  descrizione     text,
  visibile_cliente boolean NOT NULL DEFAULT true,
  tecnico_id      uuid REFERENCES utenti(id) ON DELETE SET NULL,
  nota            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Messaggi: chat tra officina e cliente per appuntamento
CREATE TABLE IF NOT EXISTS messaggi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  da              text NOT NULL,
  mittente_tipo   text,
  mittente_nome   text,
  testo           text NOT NULL,
  letto           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Magazzino: inventario ricambi dell'officina
CREATE TABLE IF NOT EXISTS magazzino (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id     uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  codice          text NOT NULL DEFAULT '',
  categoria       text NOT NULL DEFAULT '',
  quantita        integer NOT NULL DEFAULT 0,
  quantita_minima integer NOT NULL DEFAULT 0,
  prezzo_acq      numeric(10,2) NOT NULL DEFAULT 0,
  prezzo_vend     numeric(10,2) NOT NULL DEFAULT 0,
  fornitore       text,
  scorta_minima   integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Notifiche WhatsApp: messaggi inviati ai clienti
CREATE TABLE IF NOT EXISTS notifiche_wa (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id       uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  cliente_id        uuid REFERENCES clienti(id) ON DELETE SET NULL,
  appuntamento_id   uuid REFERENCES appuntamenti(id) ON DELETE SET NULL,
  tipo              text NOT NULL,
  testo             text NOT NULL,
  messaggio         text,
  stato             text NOT NULL DEFAULT 'pending',
  tel_destinatario  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Casi AI: knowledge base diagnosi
CREATE TABLE IF NOT EXISTS casi_ai (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  marca       text,
  modello     text,
  anno        integer,
  codici_obd  text,
  problema    text,
  diagnosi    text,
  soluzione   text,
  costo       numeric(10,2),
  condiviso   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fatture: documenti fiscali emessi
CREATE TABLE IF NOT EXISTS fatture (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id       uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  appuntamento_id   uuid REFERENCES appuntamenti(id) ON DELETE SET NULL,
  preventivo_id     uuid REFERENCES preventivi(id) ON DELETE SET NULL,
  numero            text NOT NULL,
  data_emissione    date NOT NULL DEFAULT CURRENT_DATE,
  cliente_nome      text NOT NULL DEFAULT '',
  cliente_cf        text,
  righe             jsonb NOT NULL DEFAULT '[]',
  subtotale         numeric(10,2) NOT NULL DEFAULT 0,
  iva               numeric(10,2) NOT NULL DEFAULT 0,
  totale            numeric(10,2) NOT NULL DEFAULT 0,
  stato             text NOT NULL DEFAULT 'bozza',
  sdi_stato         text,
  sdi_identificativo text,
  sdi_data_invio    timestamptz,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Abbonamenti: piani di sottoscrizione dell'officina
CREATE TABLE IF NOT EXISTS abbonamenti (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id             uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  piano                   text NOT NULL DEFAULT 'base',
  stato                   text NOT NULL DEFAULT 'attivo',
  data_inizio             date NOT NULL DEFAULT CURRENT_DATE,
  data_fine               date,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Pagamenti: transazioni economiche
CREATE TABLE IF NOT EXISTS pagamenti (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id         uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  abbonamento_id      uuid REFERENCES abbonamenti(id) ON DELETE SET NULL,
  importo             numeric(10,2) NOT NULL DEFAULT 0,
  descrizione         text,
  stato               text NOT NULL DEFAULT 'pending',
  stripe_payment_id   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Notifiche: notifiche in-app per gli utenti staff
CREATE TABLE IF NOT EXISTS notifiche (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officina_id uuid NOT NULL REFERENCES officine(id) ON DELETE CASCADE,
  utente_id   uuid NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'info',
  titolo      text NOT NULL DEFAULT '',
  messaggio   text NOT NULL DEFAULT '',
  letto       boolean NOT NULL DEFAULT false,
  link_tipo   text,
  link_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================
-- SEZIONE 3: Funzioni helper per RLS
-- Restituiscono l'officina_id e il cliente_id
-- dell'utente autenticato corrente
-- ============================================

-- Restituisce l'officina_id dello staff autenticato
CREATE OR REPLACE FUNCTION get_user_officina_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT officina_id
  FROM utenti
  WHERE auth_id = auth.uid()
    AND attivo = true
  LIMIT 1;
$$;

-- Restituisce l'id del cliente autenticato
CREATE OR REPLACE FUNCTION get_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM clienti
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- Restituisce l'officina_id del cliente autenticato
CREATE OR REPLACE FUNCTION get_client_officina_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT officina_id
  FROM clienti
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;


-- ============================================
-- SEZIONE 4: Abilitazione RLS su tutte le tabelle
-- ============================================

ALTER TABLE officine       ENABLE ROW LEVEL SECURITY;
ALTER TABLE utenti         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clienti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE veicoli        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appuntamenti   ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventivi     ENABLE ROW LEVEL SECURITY;
ALTER TABLE foglio_lavoro  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ricambi_usati  ENABLE ROW LEVEL SECURITY;
ALTER TABLE difetti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaggi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazzino      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifiche_wa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE casi_ai        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatture        ENABLE ROW LEVEL SECURITY;
ALTER TABLE abbonamenti    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamenti      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifiche      ENABLE ROW LEVEL SECURITY;


-- ============================================
-- SEZIONE 5: Policy RLS
-- Convenzione nomi: {tabella}_{ruolo}_{operazione}
-- ============================================

-- -----------------------------------------------
-- OFFICINE: lo staff puo leggere la propria officina
-- -----------------------------------------------
DROP POLICY IF EXISTS officine_staff_select ON officine;
CREATE POLICY officine_staff_select ON officine
  FOR SELECT USING (
    id = get_user_officina_id()
    OR id = get_client_officina_id()
  );

-- -----------------------------------------------
-- UTENTI: lo staff puo leggere i colleghi della stessa officina
-- -----------------------------------------------
DROP POLICY IF EXISTS utenti_staff_select ON utenti;
CREATE POLICY utenti_staff_select ON utenti
  FOR SELECT USING (
    officina_id = get_user_officina_id()
  );

-- -----------------------------------------------
-- CLIENTI: lo staff puo fare CRUD sui clienti della propria officina
--          il cliente puo leggere il proprio profilo
-- -----------------------------------------------
DROP POLICY IF EXISTS clienti_staff_select ON clienti;
CREATE POLICY clienti_staff_select ON clienti
  FOR SELECT USING (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS clienti_staff_insert ON clienti;
CREATE POLICY clienti_staff_insert ON clienti
  FOR INSERT WITH CHECK (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS clienti_staff_update ON clienti;
CREATE POLICY clienti_staff_update ON clienti
  FOR UPDATE USING (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS clienti_staff_delete ON clienti;
CREATE POLICY clienti_staff_delete ON clienti
  FOR DELETE USING (
    officina_id = get_user_officina_id()
  );

-- Il cliente puo leggere il proprio profilo
DROP POLICY IF EXISTS clienti_self_select ON clienti;
CREATE POLICY clienti_self_select ON clienti
  FOR SELECT USING (
    auth_id = auth.uid()
  );

-- -----------------------------------------------
-- VEICOLI: lo staff puo fare CRUD sui veicoli dei propri clienti
--          il cliente puo leggere i propri veicoli
-- -----------------------------------------------
DROP POLICY IF EXISTS veicoli_staff_select ON veicoli;
CREATE POLICY veicoli_staff_select ON veicoli
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clienti c
      WHERE c.id = veicoli.cliente_id
        AND c.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS veicoli_staff_insert ON veicoli;
CREATE POLICY veicoli_staff_insert ON veicoli
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clienti c
      WHERE c.id = veicoli.cliente_id
        AND c.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS veicoli_staff_update ON veicoli;
CREATE POLICY veicoli_staff_update ON veicoli
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clienti c
      WHERE c.id = veicoli.cliente_id
        AND c.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS veicoli_staff_delete ON veicoli;
CREATE POLICY veicoli_staff_delete ON veicoli
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clienti c
      WHERE c.id = veicoli.cliente_id
        AND c.officina_id = get_user_officina_id()
    )
  );

-- Il cliente puo leggere i propri veicoli
DROP POLICY IF EXISTS veicoli_client_select ON veicoli;
CREATE POLICY veicoli_client_select ON veicoli
  FOR SELECT USING (
    cliente_id = get_client_id()
  );

-- -----------------------------------------------
-- APPUNTAMENTI: lo staff ha CRUD completo nella propria officina
--               il cliente puo leggere e creare i propri appuntamenti
-- -----------------------------------------------
DROP POLICY IF EXISTS appuntamenti_staff_select ON appuntamenti;
CREATE POLICY appuntamenti_staff_select ON appuntamenti
  FOR SELECT USING (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS appuntamenti_staff_insert ON appuntamenti;
CREATE POLICY appuntamenti_staff_insert ON appuntamenti
  FOR INSERT WITH CHECK (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS appuntamenti_staff_update ON appuntamenti;
CREATE POLICY appuntamenti_staff_update ON appuntamenti
  FOR UPDATE USING (
    officina_id = get_user_officina_id()
  );

DROP POLICY IF EXISTS appuntamenti_staff_delete ON appuntamenti;
CREATE POLICY appuntamenti_staff_delete ON appuntamenti
  FOR DELETE USING (
    officina_id = get_user_officina_id()
  );

-- Il cliente puo leggere i propri appuntamenti
DROP POLICY IF EXISTS appuntamenti_client_select ON appuntamenti;
CREATE POLICY appuntamenti_client_select ON appuntamenti
  FOR SELECT USING (
    cliente_id = get_client_id()
  );

-- Il cliente puo creare un appuntamento (prenotazione online)
DROP POLICY IF EXISTS appuntamenti_client_insert ON appuntamenti;
CREATE POLICY appuntamenti_client_insert ON appuntamenti
  FOR INSERT WITH CHECK (
    cliente_id = get_client_id()
    AND officina_id = get_client_officina_id()
  );

-- -----------------------------------------------
-- PREVENTIVI: lo staff ha CRUD completo
--             il cliente puo leggere e aggiornare lo stato (accettare/rifiutare)
-- -----------------------------------------------
DROP POLICY IF EXISTS preventivi_staff_select ON preventivi;
CREATE POLICY preventivi_staff_select ON preventivi
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS preventivi_staff_insert ON preventivi;
CREATE POLICY preventivi_staff_insert ON preventivi
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS preventivi_staff_update ON preventivi;
CREATE POLICY preventivi_staff_update ON preventivi
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS preventivi_staff_delete ON preventivi;
CREATE POLICY preventivi_staff_delete ON preventivi
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- Il cliente puo leggere i preventivi dei propri appuntamenti
DROP POLICY IF EXISTS preventivi_client_select ON preventivi;
CREATE POLICY preventivi_client_select ON preventivi
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- Il cliente puo aggiornare solo lo stato del preventivo (accettare/rifiutare)
DROP POLICY IF EXISTS preventivi_client_update ON preventivi;
CREATE POLICY preventivi_client_update ON preventivi
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  )
  -- Limita le colonne aggiornabili tramite la WITH CHECK
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = preventivi.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- -----------------------------------------------
-- FOGLIO LAVORO: solo staff della propria officina
-- -----------------------------------------------
DROP POLICY IF EXISTS foglio_lavoro_staff_select ON foglio_lavoro;
CREATE POLICY foglio_lavoro_staff_select ON foglio_lavoro
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foglio_lavoro.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foglio_lavoro_staff_insert ON foglio_lavoro;
CREATE POLICY foglio_lavoro_staff_insert ON foglio_lavoro
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foglio_lavoro.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foglio_lavoro_staff_update ON foglio_lavoro;
CREATE POLICY foglio_lavoro_staff_update ON foglio_lavoro
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foglio_lavoro.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foglio_lavoro_staff_delete ON foglio_lavoro;
CREATE POLICY foglio_lavoro_staff_delete ON foglio_lavoro
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foglio_lavoro.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- -----------------------------------------------
-- RICAMBI USATI: solo staff (tramite foglio_lavoro -> appuntamento)
-- -----------------------------------------------
DROP POLICY IF EXISTS ricambi_usati_staff_select ON ricambi_usati;
CREATE POLICY ricambi_usati_staff_select ON ricambi_usati
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = ricambi_usati.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS ricambi_usati_staff_insert ON ricambi_usati;
CREATE POLICY ricambi_usati_staff_insert ON ricambi_usati
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = ricambi_usati.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS ricambi_usati_staff_update ON ricambi_usati;
CREATE POLICY ricambi_usati_staff_update ON ricambi_usati
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = ricambi_usati.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS ricambi_usati_staff_delete ON ricambi_usati;
CREATE POLICY ricambi_usati_staff_delete ON ricambi_usati
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = ricambi_usati.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- -----------------------------------------------
-- DIFETTI: solo staff (tramite foglio_lavoro -> appuntamento)
-- -----------------------------------------------
DROP POLICY IF EXISTS difetti_staff_select ON difetti;
CREATE POLICY difetti_staff_select ON difetti
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = difetti.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS difetti_staff_insert ON difetti;
CREATE POLICY difetti_staff_insert ON difetti
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = difetti.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS difetti_staff_update ON difetti;
CREATE POLICY difetti_staff_update ON difetti
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = difetti.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS difetti_staff_delete ON difetti;
CREATE POLICY difetti_staff_delete ON difetti
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM foglio_lavoro fl
      JOIN appuntamenti a ON a.id = fl.appuntamento_id
      WHERE fl.id = difetti.foglio_lavoro_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- -----------------------------------------------
-- FOTO: lo staff ha CRUD; il cliente puo solo leggere
--       le foto dei propri appuntamenti (se visibile_cliente = true)
-- -----------------------------------------------
DROP POLICY IF EXISTS foto_staff_select ON foto;
CREATE POLICY foto_staff_select ON foto
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foto.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foto_staff_insert ON foto;
CREATE POLICY foto_staff_insert ON foto
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foto.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foto_staff_update ON foto;
CREATE POLICY foto_staff_update ON foto
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foto.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS foto_staff_delete ON foto;
CREATE POLICY foto_staff_delete ON foto
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foto.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- Il cliente puo leggere le foto visibili dei propri appuntamenti
DROP POLICY IF EXISTS foto_client_select ON foto;
CREATE POLICY foto_client_select ON foto
  FOR SELECT USING (
    visibile_cliente = true
    AND EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = foto.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- -----------------------------------------------
-- MESSAGGI: staff e clienti possono leggere e inserire
--           messaggi nei propri appuntamenti
-- -----------------------------------------------
DROP POLICY IF EXISTS messaggi_staff_select ON messaggi;
CREATE POLICY messaggi_staff_select ON messaggi
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = messaggi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

DROP POLICY IF EXISTS messaggi_staff_insert ON messaggi;
CREATE POLICY messaggi_staff_insert ON messaggi
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = messaggi.appuntamento_id
        AND a.officina_id = get_user_officina_id()
    )
  );

-- Il cliente puo leggere i messaggi dei propri appuntamenti
DROP POLICY IF EXISTS messaggi_client_select ON messaggi;
CREATE POLICY messaggi_client_select ON messaggi
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = messaggi.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- Il cliente puo inserire messaggi nei propri appuntamenti
DROP POLICY IF EXISTS messaggi_client_insert ON messaggi;
CREATE POLICY messaggi_client_insert ON messaggi
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id = messaggi.appuntamento_id
        AND a.cliente_id = get_client_id()
    )
  );

-- -----------------------------------------------
-- MAGAZZINO: solo staff della propria officina
-- -----------------------------------------------
DROP POLICY IF EXISTS magazzino_staff_select ON magazzino;
CREATE POLICY magazzino_staff_select ON magazzino
  FOR SELECT USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS magazzino_staff_insert ON magazzino;
CREATE POLICY magazzino_staff_insert ON magazzino
  FOR INSERT WITH CHECK (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS magazzino_staff_update ON magazzino;
CREATE POLICY magazzino_staff_update ON magazzino
  FOR UPDATE USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS magazzino_staff_delete ON magazzino;
CREATE POLICY magazzino_staff_delete ON magazzino
  FOR DELETE USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- NOTIFICHE WA: solo staff della propria officina
-- -----------------------------------------------
DROP POLICY IF EXISTS notifiche_wa_staff_select ON notifiche_wa;
CREATE POLICY notifiche_wa_staff_select ON notifiche_wa
  FOR SELECT USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS notifiche_wa_staff_insert ON notifiche_wa;
CREATE POLICY notifiche_wa_staff_insert ON notifiche_wa
  FOR INSERT WITH CHECK (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS notifiche_wa_staff_update ON notifiche_wa;
CREATE POLICY notifiche_wa_staff_update ON notifiche_wa
  FOR UPDATE USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- CASI AI: solo staff della propria officina
-- (i casi condivisi sono accessibili a tutti gli staff)
-- -----------------------------------------------
DROP POLICY IF EXISTS casi_ai_staff_select ON casi_ai;
CREATE POLICY casi_ai_staff_select ON casi_ai
  FOR SELECT USING (
    officina_id = get_user_officina_id()
    OR condiviso = true
  );

DROP POLICY IF EXISTS casi_ai_staff_insert ON casi_ai;
CREATE POLICY casi_ai_staff_insert ON casi_ai
  FOR INSERT WITH CHECK (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS casi_ai_staff_update ON casi_ai;
CREATE POLICY casi_ai_staff_update ON casi_ai
  FOR UPDATE USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS casi_ai_staff_delete ON casi_ai;
CREATE POLICY casi_ai_staff_delete ON casi_ai
  FOR DELETE USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- FATTURE: solo staff della propria officina (CRUD completo)
-- -----------------------------------------------
DROP POLICY IF EXISTS fatture_staff_select ON fatture;
CREATE POLICY fatture_staff_select ON fatture
  FOR SELECT USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS fatture_staff_insert ON fatture;
CREATE POLICY fatture_staff_insert ON fatture
  FOR INSERT WITH CHECK (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS fatture_staff_update ON fatture;
CREATE POLICY fatture_staff_update ON fatture
  FOR UPDATE USING (officina_id = get_user_officina_id());

DROP POLICY IF EXISTS fatture_staff_delete ON fatture;
CREATE POLICY fatture_staff_delete ON fatture
  FOR DELETE USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- ABBONAMENTI: solo lettura per lo staff (gestiti dal sistema)
-- -----------------------------------------------
DROP POLICY IF EXISTS abbonamenti_staff_select ON abbonamenti;
CREATE POLICY abbonamenti_staff_select ON abbonamenti
  FOR SELECT USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- PAGAMENTI: solo lettura per lo staff (gestiti dal sistema)
-- -----------------------------------------------
DROP POLICY IF EXISTS pagamenti_staff_select ON pagamenti;
CREATE POLICY pagamenti_staff_select ON pagamenti
  FOR SELECT USING (officina_id = get_user_officina_id());

-- -----------------------------------------------
-- NOTIFICHE: lo staff puo leggere e aggiornare (segna come letto)
-- solo le proprie notifiche
-- -----------------------------------------------
DROP POLICY IF EXISTS notifiche_staff_select ON notifiche;
CREATE POLICY notifiche_staff_select ON notifiche
  FOR SELECT USING (
    utente_id IN (
      SELECT id FROM utenti WHERE auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notifiche_staff_update ON notifiche;
CREATE POLICY notifiche_staff_update ON notifiche
  FOR UPDATE USING (
    utente_id IN (
      SELECT id FROM utenti WHERE auth_id = auth.uid()
    )
  );


-- ============================================
-- SEZIONE 6: Indici per query frequenti
-- ============================================

-- Appuntamenti: ricerca per officina, cliente, data e stato
CREATE INDEX IF NOT EXISTS idx_appuntamenti_officina_id ON appuntamenti(officina_id);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_cliente_id ON appuntamenti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_data_ora ON appuntamenti(data_ora);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_stato ON appuntamenti(stato);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_officina_stato ON appuntamenti(officina_id, stato);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_officina_data ON appuntamenti(officina_id, data_ora);

-- Messaggi: ordinamento per appuntamento e data
CREATE INDEX IF NOT EXISTS idx_messaggi_appuntamento_id ON messaggi(appuntamento_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_created_at ON messaggi(created_at);
CREATE INDEX IF NOT EXISTS idx_messaggi_appuntamento_created ON messaggi(appuntamento_id, created_at);

-- Foto: ricerca per appuntamento
CREATE INDEX IF NOT EXISTS idx_foto_appuntamento_id ON foto(appuntamento_id);

-- Fatture: ricerca per officina e stato
CREATE INDEX IF NOT EXISTS idx_fatture_officina_id ON fatture(officina_id);
CREATE INDEX IF NOT EXISTS idx_fatture_stato ON fatture(stato);
CREATE INDEX IF NOT EXISTS idx_fatture_officina_stato ON fatture(officina_id, stato);

-- Notifiche: ricerca per utente e stato di lettura
CREATE INDEX IF NOT EXISTS idx_notifiche_utente_id ON notifiche(utente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_letto ON notifiche(letto);
CREATE INDEX IF NOT EXISTS idx_notifiche_utente_letto ON notifiche(utente_id, letto);

-- Utenti: ricerca per auth_id (usato dalle funzioni helper)
CREATE INDEX IF NOT EXISTS idx_utenti_auth_id ON utenti(auth_id);
CREATE INDEX IF NOT EXISTS idx_utenti_officina_id ON utenti(officina_id);

-- Clienti: ricerca per auth_id e officina
CREATE INDEX IF NOT EXISTS idx_clienti_auth_id ON clienti(auth_id);
CREATE INDEX IF NOT EXISTS idx_clienti_officina_id ON clienti(officina_id);

-- Veicoli: ricerca per cliente e targa
CREATE INDEX IF NOT EXISTS idx_veicoli_cliente_id ON veicoli(cliente_id);
CREATE INDEX IF NOT EXISTS idx_veicoli_targa ON veicoli(targa);

-- Foglio lavoro: ricerca per appuntamento
CREATE INDEX IF NOT EXISTS idx_foglio_lavoro_appuntamento_id ON foglio_lavoro(appuntamento_id);

-- Preventivi: ricerca per appuntamento
CREATE INDEX IF NOT EXISTS idx_preventivi_appuntamento_id ON preventivi(appuntamento_id);

-- Magazzino: ricerca per officina e codice
CREATE INDEX IF NOT EXISTS idx_magazzino_officina_id ON magazzino(officina_id);
CREATE INDEX IF NOT EXISTS idx_magazzino_codice ON magazzino(codice);

-- Notifiche WA: ricerca per officina
CREATE INDEX IF NOT EXISTS idx_notifiche_wa_officina_id ON notifiche_wa(officina_id);

-- Casi AI: ricerca per officina e codici OBD
CREATE INDEX IF NOT EXISTS idx_casi_ai_officina_id ON casi_ai(officina_id);
CREATE INDEX IF NOT EXISTS idx_casi_ai_codici_obd ON casi_ai(codici_obd);

-- Abbonamenti e pagamenti
CREATE INDEX IF NOT EXISTS idx_abbonamenti_officina_id ON abbonamenti(officina_id);
CREATE INDEX IF NOT EXISTS idx_pagamenti_officina_id ON pagamenti(officina_id);


-- ============================================
-- SEZIONE 7: Policy per Supabase Storage
-- Bucket "foto-lavorazione" per le foto degli appuntamenti
-- ============================================

-- Crea il bucket se non esiste (via SQL - Supabase storage schema)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'foto-lavorazione',
  'foto-lavorazione',
  false,
  10485760, -- 10MB limite
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lo staff puo caricare foto nella cartella della propria officina
-- Struttura path: {officina_id}/{appuntamento_id}/{filename}
DROP POLICY IF EXISTS "staff_upload_foto" ON storage.objects;
CREATE POLICY "staff_upload_foto" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'foto-lavorazione'
    AND (storage.foldername(name))[1] = get_user_officina_id()::text
  );

-- Lo staff puo leggere le foto della propria officina
DROP POLICY IF EXISTS "staff_read_foto" ON storage.objects;
CREATE POLICY "staff_read_foto" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'foto-lavorazione'
    AND (storage.foldername(name))[1] = get_user_officina_id()::text
  );

-- Lo staff puo aggiornare le foto della propria officina
DROP POLICY IF EXISTS "staff_update_foto" ON storage.objects;
CREATE POLICY "staff_update_foto" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'foto-lavorazione'
    AND (storage.foldername(name))[1] = get_user_officina_id()::text
  );

-- Lo staff puo eliminare le foto della propria officina
DROP POLICY IF EXISTS "staff_delete_foto" ON storage.objects;
CREATE POLICY "staff_delete_foto" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'foto-lavorazione'
    AND (storage.foldername(name))[1] = get_user_officina_id()::text
  );

-- Il cliente puo leggere le foto dei propri appuntamenti
-- (deve conoscere l'officina_id e l'appuntamento_id)
DROP POLICY IF EXISTS "client_read_foto" ON storage.objects;
CREATE POLICY "client_read_foto" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'foto-lavorazione'
    AND (storage.foldername(name))[1] = get_client_officina_id()::text
    AND EXISTS (
      SELECT 1 FROM appuntamenti a
      WHERE a.id::text = (storage.foldername(name))[2]
        AND a.cliente_id = get_client_id()
    )
  );


-- ============================================
-- FINE MIGRAZIONE 001
-- ============================================
