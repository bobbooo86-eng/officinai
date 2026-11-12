import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, Loader, Button, Input } from '@/components/ui';

interface OfficinaRiga {
  id: string;
  nome: string;
  email: string | null;
  tel: string | null;
  comune: string | null;
  provincia: string | null;
  created_at: string;
  note_admin: string | null;
  archiviata: boolean;
}

type Piano = 'starter' | 'professional' | 'enterprise';
type StatoAbbonamento = 'trial' | 'attivo' | 'scaduto';

interface AbbonamentoRiga {
  officina_id: string;
  piano: Piano;
  stato: StatoAbbonamento;
  data_inizio: string;
  data_fine: string;
}

// Prezzi mensili indicativi (gli stessi di SubscriptionPage), solo per
// stimare l'incasso ricorrente nel pannello — non la fonte di verita'
// dei prezzi veri, che restano su Stripe.
const PREZZO_MENSILE: Record<Piano, number> = { starter: 49, professional: 99, enterprise: 199 };

function formatData(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function statoBadge(stato?: string) {
  switch (stato) {
    case 'attivo':
      return { label: 'Attivo (paga)', color: '#065f46', bg: '#d1fae5' };
    case 'trial':
      return { label: 'In prova', color: '#92400e', bg: '#fef3c7' };
    case 'scaduto':
      return { label: 'Sospeso / scaduto', color: '#991b1b', bg: '#fee2e2' };
    default:
      return { label: 'Nessun abbonamento', color: '#374151', bg: '#f3f4f6' };
  }
}

function giorniRimasti(dataFine?: string): number | null {
  if (!dataFine) return null;
  const ms = new Date(dataFine).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function addGiorni(date: Date, giorni: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + giorni);
  return d;
}

// ==================== Dettaglio officina ====================

interface DettaglioProps {
  officina: OfficinaRiga;
  abbonamento: AbbonamentoRiga | null;
  onClose: () => void;
  onAggiornato: (officinaId: string, abb: AbbonamentoRiga | null, note: string | null) => void;
  onArchiviata: (officinaId: string, archiviata: boolean) => void;
  onEliminata: (officinaId: string) => void;
}

function DettaglioOfficina({ officina, abbonamento, onClose, onAggiornato, onArchiviata, onEliminata }: DettaglioProps) {
  const [salvandoArchivio, setSalvandoArchivio] = useState(false);
  const [confermaNome, setConfermaNome] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [erroreEliminazione, setErroreEliminazione] = useState<string | null>(null);

  const toggleArchivio = async () => {
    const nuovoValore = !officina.archiviata;
    setSalvandoArchivio(true);
    const { error } = await supabase.from('officine').update({ archiviata: nuovoValore }).eq('id', officina.id);
    setSalvandoArchivio(false);
    if (!error) {
      onArchiviata(officina.id, nuovoValore);
      onClose();
    }
  };

  const eliminaDefinitivamente = async () => {
    if (confermaNome.trim() !== officina.nome.trim()) return;
    setEliminando(true);
    setErroreEliminazione(null);
    const { error } = await supabase.rpc('elimina_officina_definitivamente', { p_officina_id: officina.id });
    setEliminando(false);
    if (error) {
      setErroreEliminazione(error.message);
      return;
    }
    onEliminata(officina.id);
    onClose();
  };

  const [titolare, setTitolare] = useState<{ nome: string; email: string; tel: string } | null | undefined>(undefined);
  const [nClienti, setNClienti] = useState<number | null>(null);
  const [nAppuntamenti, setNAppuntamenti] = useState<number | null>(null);
  const [piano, setPiano] = useState<Piano>(abbonamento?.piano || 'professional');
  const [stato, setStato] = useState<StatoAbbonamento>(abbonamento?.stato || 'trial');
  const [dataFine, setDataFine] = useState<string>(
    abbonamento?.data_fine ? abbonamento.data_fine.slice(0, 10) : addGiorni(new Date(), 60).toISOString().slice(0, 10)
  );
  const [nota, setNota] = useState(officina.note_admin || '');
  const [salvando, setSalvando] = useState(false);
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: tit }, { count: cc }, { count: ac }] = await Promise.all([
        supabase.from('utenti').select('nome, email, tel').eq('officina_id', officina.id).eq('ruolo', 'titolare').limit(1).maybeSingle(),
        supabase.from('clienti').select('id', { count: 'exact', head: true }).eq('officina_id', officina.id),
        supabase.from('appuntamenti').select('id', { count: 'exact', head: true }).eq('officina_id', officina.id),
      ]);
      setTitolare(tit || null);
      setNClienti(cc ?? 0);
      setNAppuntamenti(ac ?? 0);
    };
    fetch();
  }, [officina.id]);

  const salvaAbbonamento = async (override?: Partial<{ piano: Piano; stato: StatoAbbonamento; data_fine: string }>) => {
    setSalvando(true);
    setMessaggio(null);
    const nuovoPiano = override?.piano ?? piano;
    const nuovoStato = override?.stato ?? stato;
    const nuovaDataFine = override?.data_fine ?? dataFine;

    const { data, error } = await supabase
      .from('abbonamenti')
      .upsert(
        {
          officina_id: officina.id,
          piano: nuovoPiano,
          stato: nuovoStato,
          data_inizio: abbonamento?.data_inizio || new Date().toISOString(),
          data_fine: new Date(nuovaDataFine).toISOString(),
        },
        { onConflict: 'officina_id' }
      )
      .select()
      .single();

    setSalvando(false);
    if (error) {
      setMessaggio('Errore: ' + error.message);
      return;
    }
    setPiano(nuovoPiano);
    setStato(nuovoStato);
    setDataFine(nuovaDataFine);
    setMessaggio('Salvato.');
    onAggiornato(officina.id, data as AbbonamentoRiga, null);
  };

  const attiva1Anno = () => salvaAbbonamento({ stato: 'attivo', data_fine: addGiorni(new Date(), 365).toISOString().slice(0, 10) });
  const sospendi = () => salvaAbbonamento({ stato: 'scaduto' });
  const estendiProva30 = () => {
    const base = abbonamento?.data_fine ? new Date(abbonamento.data_fine) : new Date();
    const partenza = base.getTime() > Date.now() ? base : new Date();
    salvaAbbonamento({ stato: 'trial', data_fine: addGiorni(partenza, 30).toISOString().slice(0, 10) });
  };

  const salvaNota = async () => {
    setSalvandoNota(true);
    const { error } = await supabase.from('officine').update({ note_admin: nota || null }).eq('id', officina.id);
    setSalvandoNota(false);
    if (!error) onAggiornato(officina.id, null, nota || null);
  };

  const giorni = giorniRimasti(stato === 'trial' ? dataFine : undefined);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg my-8 sm:my-0 max-h-[88vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{officina.nome}</h2>
            <p className="text-xs text-gray-500">{officina.comune ? `${officina.comune} (${officina.provincia || ''})` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none" aria-label="Chiudi">✕</button>
        </div>

        {/* Titolare */}
        <div className="bg-gray-50 rounded-xl p-3 text-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Titolare</div>
          {titolare === undefined ? (
            <div className="text-gray-400">Caricamento...</div>
          ) : titolare ? (
            <div className="space-y-0.5">
              <div className="font-semibold text-gray-900">{titolare.nome}</div>
              <div className="text-gray-500">{titolare.email} {titolare.tel && `· ${titolare.tel}`}</div>
            </div>
          ) : (
            <div className="text-gray-400">Nessun titolare trovato</div>
          )}
        </div>

        {/* Contatori */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-extrabold text-gray-900">{nClienti ?? '—'}</div>
            <div className="text-xs text-gray-500">Clienti</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-extrabold text-gray-900">{nAppuntamenti ?? '—'}</div>
            <div className="text-xs text-gray-500">Appuntamenti</div>
          </div>
        </div>

        {/* Abbonamento */}
        <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Abbonamento</span>
            <Badge color={statoBadge(stato).color} bg={statoBadge(stato).bg}>{statoBadge(stato).label}</Badge>
          </div>
          {giorni !== null && (
            <p className="text-xs text-gray-500">{giorni >= 0 ? `${giorni} giorni di prova rimasti` : 'Prova scaduta'}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Piano</label>
              <select
                value={piano}
                onChange={(e) => setPiano(e.target.value as Piano)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stato</label>
              <select
                value={stato}
                onChange={(e) => setStato(e.target.value as StatoAbbonamento)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
              >
                <option value="trial">In prova</option>
                <option value="attivo">Attivo (paga)</option>
                <option value="scaduto">Sospeso / scaduto</option>
              </select>
            </div>
          </div>
          <Input label="Scadenza" type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} />
          <Button variant="secondary" fullWidth onClick={() => salvaAbbonamento()} disabled={salvando}>
            {salvando ? 'Salvataggio...' : 'Salva modifiche'}
          </Button>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button onClick={attiva1Anno} disabled={salvando} className="px-2 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 cursor-pointer disabled:opacity-50">Attiva 1 anno</button>
            <button onClick={estendiProva30} disabled={salvando} className="px-2 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold hover:bg-amber-100 cursor-pointer disabled:opacity-50">+30gg prova</button>
            <button onClick={sospendi} disabled={salvando} className="px-2 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 cursor-pointer disabled:opacity-50">Sospendi</button>
          </div>
          {messaggio && <p className="text-xs text-gray-500">{messaggio}</p>}
        </div>

        {/* Contatti rapidi */}
        <div className="flex gap-2">
          {officina.email && <a href={`mailto:${officina.email}`} className="flex-1 text-center text-sm py-2 bg-gray-50 rounded-xl text-blue-600 font-medium">✉️ Email</a>}
          {officina.tel && <a href={`tel:${officina.tel}`} className="flex-1 text-center text-sm py-2 bg-gray-50 rounded-xl text-blue-600 font-medium">📞 Chiama</a>}
        </div>

        {/* Nota privata */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nota privata (solo tu la vedi)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Es. contattato il 12/11, interessato al piano Professional..."
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none"
          />
          <Button variant="secondary" fullWidth className="mt-2" onClick={salvaNota} disabled={salvandoNota}>
            {salvandoNota ? 'Salvataggio...' : 'Salva nota'}
          </Button>
        </div>

        {/* Archiviazione: come per i clienti, non e' una cancellazione
            vera (i dati dell'officina — appuntamenti, fatture, movimenti —
            restano), solo nascosta dall'elenco e ripristinabile. */}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={toggleArchivio}
            disabled={salvandoArchivio}
            className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
          >
            {salvandoArchivio ? 'Salvataggio...' : officina.archiviata ? '↩️ Ripristina officina' : '🗑️ Archivia officina'}
          </button>
        </div>

        {/* Eliminazione vera, solo da archiviata: non reversibile. */}
        {officina.archiviata && (
          <div className="border border-red-200 bg-red-50 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-red-700 uppercase tracking-wide">Zona pericolosa</div>
            <p className="text-xs text-red-700">
              Elimina per sempre tutti i dati di "{officina.nome}" (appuntamenti, clienti, fatture, movimenti...).
              Non si può annullare. Per confermare scrivi esattamente il nome dell'officina qui sotto.
            </p>
            <Input
              value={confermaNome}
              onChange={(e) => setConfermaNome(e.target.value)}
              placeholder={officina.nome}
            />
            <Button
              variant="danger"
              fullWidth
              onClick={eliminaDefinitivamente}
              disabled={eliminando || confermaNome.trim() !== officina.nome.trim()}
            >
              {eliminando ? 'Eliminazione in corso...' : 'Elimina definitivamente'}
            </Button>
            {erroreEliminazione && <p className="text-xs text-red-700">{erroreEliminazione}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Pagina principale ====================

export function AdminPage() {
  const [officine, setOfficine] = useState<OfficinaRiga[]>([]);
  const [abbonamenti, setAbbonamenti] = useState<Record<string, AbbonamentoRiga>>({});
  const [loading, setLoading] = useState(true);
  const [ricerca, setRicerca] = useState('');
  const [selezionata, setSelezionata] = useState<OfficinaRiga | null>(null);
  const [mostraArchiviate, setMostraArchiviate] = useState(false);

  const ricarica = async () => {
    const [{ data: off }, { data: abb }] = await Promise.all([
      supabase
        .from('officine')
        .select('id, nome, email, tel, comune, provincia, created_at, note_admin, archiviata')
        .order('created_at', { ascending: false }),
      supabase.from('abbonamenti').select('officina_id, piano, stato, data_inizio, data_fine'),
    ]);

    setOfficine((off as OfficinaRiga[]) || []);
    const mappa: Record<string, AbbonamentoRiga> = {};
    ((abb as AbbonamentoRiga[]) || []).forEach((a) => { mappa[a.officina_id] = a; });
    setAbbonamenti(mappa);
    setLoading(false);
  };

  useEffect(() => { ricarica(); }, []);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <Loader size="lg" text="Caricamento officine..." />
      </div>
    );
  }

  const attive = officine.filter((o) => mostraArchiviate || !o.archiviata);

  const filtrate = attive.filter((o) => {
    const s = ricerca.trim().toLowerCase();
    if (!s) return true;
    return (
      o.nome.toLowerCase().includes(s) ||
      (o.email || '').toLowerCase().includes(s) ||
      (o.comune || '').toLowerCase().includes(s)
    );
  });

  const nonArchiviate = officine.filter((o) => !o.archiviata);
  const inProva = nonArchiviate.filter((o) => abbonamenti[o.id]?.stato === 'trial').length;
  const paganti = nonArchiviate.filter((o) => abbonamenti[o.id]?.stato === 'attivo').length;
  const inScadenza = nonArchiviate.filter((o) => {
    const a = abbonamenti[o.id];
    if (a?.stato !== 'trial') return false;
    const g = giorniRimasti(a.data_fine);
    return g !== null && g <= 7 && g >= 0;
  }).length;
  const mrrStimato = nonArchiviate.reduce((tot, o) => {
    const a = abbonamenti[o.id];
    if (a?.stato !== 'attivo') return tot;
    return tot + (PREZZO_MENSILE[a.piano] || 0);
  }, 0);

  // Ordina: chi è in scadenza entro 7 giorni prima di tutti gli altri.
  const ordinate = [...filtrate].sort((a, b) => {
    const ga = abbonamenti[a.id]?.stato === 'trial' ? giorniRimasti(abbonamenti[a.id].data_fine) : null;
    const gb = abbonamenti[b.id]?.stato === 'trial' ? giorniRimasti(abbonamenti[b.id].data_fine) : null;
    const urgA = ga !== null && ga <= 7 ? 0 : 1;
    const urgB = gb !== null && gb <= 7 ? 0 : 1;
    if (urgA !== urgB) return urgA - urgB;
    return 0;
  });

  return (
    <div className="p-4 space-y-5 pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">🔒 Pannello amministratore</h2>
        <p className="text-sm text-gray-500 mt-0.5">Tutte le officine registrate su OfficinAI — visibile solo a te.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-gray-900">{nonArchiviate.length}</div>
          <div className="text-xs text-gray-500">Officine totali</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-amber-600">{inProva}</div>
          <div className="text-xs text-gray-500">In prova</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-emerald-600">{paganti}</div>
          <div className="text-xs text-gray-500">Paganti</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-red-600">{inScadenza}</div>
          <div className="text-xs text-gray-500">In scadenza (7gg)</div>
        </Card>
      </div>

      <Card className="!p-4 !bg-gradient-to-br !from-emerald-50 !to-blue-50 !border-emerald-200">
        <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Incasso ricorrente stimato</div>
        <div className="text-2xl font-extrabold text-gray-900 mt-1">{formatEuro(mrrStimato)}<span className="text-sm font-medium text-gray-500">/mese</span></div>
        <p className="text-xs text-gray-500 mt-1">Somma dei piani di chi risulta "Attivo" — stima sui prezzi di listino, non sostituisce Stripe.</p>
      </Card>

      <input
        type="text"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
        placeholder="Cerca per nome, email o città..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer -mt-2">
        <input type="checkbox" checked={mostraArchiviate} onChange={(e) => setMostraArchiviate(e.target.checked)} />
        Mostra anche le officine archiviate
      </label>

      <div className="space-y-3">
        {ordinate.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">Nessuna officina trovata.</div>
        ) : (
          ordinate.map((o) => {
            const abb = abbonamenti[o.id];
            const badge = statoBadge(abb?.stato);
            const giorni = abb?.stato === 'trial' ? giorniRimasti(abb.data_fine) : null;
            return (
              <Card key={o.id} className={`!p-4 cursor-pointer hover:shadow-md transition-shadow ${o.archiviata ? 'opacity-50' : ''}`} onClick={() => setSelezionata(o)}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-bold text-gray-900">{o.nome} {o.archiviata && <span className="text-xs font-normal text-gray-400">(archiviata)</span>}</div>
                    <div className="text-xs text-gray-500">{o.comune ? `${o.comune} (${o.provincia || ''})` : 'Città non indicata'}</div>
                  </div>
                  <Badge color={badge.color} bg={badge.bg}>{badge.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Registrata il {formatData(o.created_at)}</span>
                  {abb && <span>Piano: {abb.piano}</span>}
                  {giorni !== null && (
                    <span className={giorni <= 7 ? 'text-amber-600 font-semibold' : ''}>
                      {giorni >= 0 ? `${giorni} giorni di prova rimasti` : 'Prova scaduta'}
                    </span>
                  )}
                  {o.note_admin && <span className="text-gray-400">📝 nota salvata</span>}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {selezionata && (
        <DettaglioOfficina
          officina={selezionata}
          abbonamento={abbonamenti[selezionata.id] || null}
          onClose={() => setSelezionata(null)}
          onAggiornato={(officinaId, abb, note) => {
            if (abb) setAbbonamenti((prev) => ({ ...prev, [officinaId]: abb }));
            if (note !== null) setOfficine((prev) => prev.map((o) => (o.id === officinaId ? { ...o, note_admin: note } : o)));
          }}
          onArchiviata={(officinaId, archiviata) => {
            setOfficine((prev) => prev.map((o) => (o.id === officinaId ? { ...o, archiviata } : o)));
          }}
          onEliminata={(officinaId) => {
            setOfficine((prev) => prev.filter((o) => o.id !== officinaId));
          }}
        />
      )}
    </div>
  );
}
