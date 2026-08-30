import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { DB_REPAIR_SQL } from '@/lib/dbRepairSql';

type Esito = 'ok' | 'errore';

interface Controllo {
  nome: string;
  esito: Esito;
  dettaglio: string;
}

/**
 * Verifica che il database contenga le tabelle, le colonne e i bucket che
 * l'app si aspetta. Serve a distinguere un bug dell'app da migrazioni non
 * ancora applicate, e a fornire lo script SQL da eseguire su Supabase.
 */
async function eseguiControlli(): Promise<Controllo[]> {
  const esiti: Controllo[] = [];

  // Le SELECT non modificano nulla: se una colonna o tabella manca,
  // PostgREST risponde con un errore che identifica il problema.
  const tabelle: { tabella: string; colonne: string; etichetta: string }[] = [
    { tabella: 'movimenti', colonne: 'id,tipo,importo,data', etichetta: 'Cassa (tabella movimenti)' },
    { tabella: 'magazzino', colonne: 'id,nome,codice,categoria,quantita,quantita_minima,prezzo_acq,prezzo_vend', etichetta: 'Magazzino (colonne articoli)' },
    { tabella: 'clienti', colonne: 'id,nome,codice_fiscale,indirizzo,note', etichetta: 'Clienti (anagrafica completa)' },
    { tabella: 'appuntamenti', colonne: 'id,data_ora,problema,data_proposta,nota_officina,pagamento', etichetta: 'Appuntamenti (proposte e pagamenti)' },
    { tabella: 'preventivi', colonne: 'id,righe,totale', etichetta: 'Preventivi' },
    { tabella: 'impostazioni_email', colonne: 'officina_id', etichetta: 'Impostazioni email' },
    { tabella: 'contatti_landing', colonne: 'id', etichetta: 'Contatti dal sito' },
  ];

  for (const { tabella, colonne, etichetta } of tabelle) {
    const { error } = await supabase.from(tabella).select(colonne).limit(1);
    esiti.push({
      nome: etichetta,
      esito: error ? 'errore' : 'ok',
      dettaglio: error ? error.message : 'Tutto a posto',
    });
  }

  // Lo stato 'consegnato' e' usato dall'app per chiudere un lavoro: se manca
  // dall'enum, la consegna del veicolo fallisce sempre.
  {
    const { error } = await supabase.from('appuntamenti').select('id').eq('stato', 'consegnato').limit(1);
    esiti.push({
      nome: 'Stato "consegnato" disponibile',
      esito: error ? 'errore' : 'ok',
      dettaglio: error ? error.message : 'Tutto a posto',
    });
  }

  // I bucket Storage servono per il logo e per il link del preventivo.
  for (const bucket of ['preventivi', 'logos', 'foto-lavorazione']) {
    const { error } = await supabase.storage.from(bucket).list('', { limit: 1 });
    esiti.push({
      nome: `Storage: bucket ${bucket}`,
      esito: error ? 'errore' : 'ok',
      dettaglio: error ? error.message : 'Tutto a posto',
    });
  }

  return esiti;
}

export function DatabaseStatus() {
  const [controlli, setControlli] = useState<Controllo[] | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [mostraSql, setMostraSql] = useState(false);

  const verifica = async () => {
    setVerificando(true);
    setControlli(await eseguiControlli());
    setVerificando(false);
  };

  const copiaSql = async () => {
    try {
      await navigator.clipboard.writeText(DB_REPAIR_SQL);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 4000);
    } catch {
      // Se la clipboard non e disponibile (permessi, http), mostra il testo
      // cosi l'utente puo selezionarlo e copiarlo a mano.
      setMostraSql(true);
    }
  };

  const problemi = controlli?.filter((c) => c.esito === 'errore') ?? [];

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Stato database</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Controlla che il database Supabase sia allineato con l'app. Se qualcosa manca,
        Cassa, Magazzino o i preventivi possono dare errore in salvataggio.
      </p>

      <Button variant="secondary" onClick={verifica} loading={verificando} fullWidth>
        🔍 Verifica database
      </Button>

      {controlli && (
        <div className="mt-3 space-y-1.5">
          {controlli.map((c) => (
            <div
              key={c.nome}
              className={`p-2.5 rounded-lg text-xs ${
                c.esito === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              <div className="font-semibold">
                {c.esito === 'ok' ? '✅' : '❌'} {c.nome}
              </div>
              {c.esito === 'errore' && (
                <div className="mt-0.5 opacity-80 break-words">{c.dettaglio}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {controlli && problemi.length === 0 && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-800 dark:text-emerald-200 font-semibold">
          Il database è allineato: nessuna azione necessaria.
        </div>
      )}

      {controlli && problemi.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
            Come sistemare ({problemi.length} {problemi.length === 1 ? 'problema' : 'problemi'})
          </div>
          <ol className="text-xs text-amber-900 dark:text-amber-100 space-y-1 list-decimal list-inside mb-3">
            <li>Premi «Copia SQL di riparazione» qui sotto.</li>
            <li>Apri <span className="font-semibold">supabase.com</span> ed entra nel progetto.</li>
            <li>Menu a sinistra: <span className="font-semibold">SQL Editor</span> → <span className="font-semibold">New query</span>.</li>
            <li>Incolla e premi <span className="font-semibold">Run</span>.</li>
            <li>
              Sempre su Supabase: <span className="font-semibold">Settings → API →
              Restart server</span>, poi attendi circa 30 secondi.
            </li>
            <li>Torna qui e premi di nuovo «Verifica database».</li>
          </ol>
          <p className="text-[11px] text-amber-800 dark:text-amber-200 mb-2">
            Il passaggio 5 serve perché, subito dopo aver creato tabelle o colonne,
            Supabase può continuare a dichiararle inesistenti finché non riavvia
            le API: in quel caso l'errore resta identico anche se lo script è
            andato a buon fine.
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-200 mb-2">
            Lo script aggiunge solo cio' che manca: non cancella né modifica dati esistenti,
            e puo' essere eseguito più volte senza rischi.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={copiaSql} fullWidth>
              {copiato ? '✅ Copiato!' : '📋 Copia SQL di riparazione'}
            </Button>
            <Button variant="secondary" onClick={() => setMostraSql((v) => !v)} fullWidth>
              {mostraSql ? 'Nascondi SQL' : 'Mostra SQL'}
            </Button>
          </div>
          {mostraSql && (
            <textarea
              readOnly
              value={DB_REPAIR_SQL}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full h-48 p-2 text-[10px] font-mono rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
            />
          )}
        </div>
      )}
    </Card>
  );
}
