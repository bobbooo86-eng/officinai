import { useEffect, useState } from 'react';
import { Card, Badge, Loader, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { ScansioneOBD, Appuntamento } from '@/types/database';

// OBD2 codes database (matching AIDiagnostics)
const OBD_DATABASE: Record<string, { desc: string; causa: string }> = {
  P0300: { desc: 'Misfiring casuale/multiplo', causa: 'Candele, bobine, iniettori' },
  P0171: { desc: 'Sistema troppo magro (Banco 1)', causa: 'Perdita aria, sonda lambda' },
  P0420: { desc: 'Efficienza catalizzatore sotto soglia', causa: 'Catalizzatore esaurito' },
  P0442: { desc: 'Perdita piccola sistema EVAP', causa: 'Tappo serbatoio, tubazioni' },
  P0455: { desc: 'Perdita grande sistema EVAP', causa: 'Tappo serbatoio aperto' },
  P0128: { desc: 'Termostato sotto temperatura', causa: 'Termostato bloccato aperto' },
  P0401: { desc: 'Flusso EGR insufficiente', causa: 'Valvola EGR intasata' },
  P0500: { desc: 'Malfunzionamento sensore velocità', causa: 'Sensore VSS difettoso' },
  P0113: { desc: 'Sensore temp. aria - segnale alto', causa: 'Sensore IAT difettoso' },
  P0340: { desc: 'Malfunzionamento sensore albero a camme', causa: 'Sensore CMP difettoso' },
  C0035: { desc: 'Sensore velocità ruota ant. sx', causa: 'Sensore ABS difettoso' },
  B0100: { desc: 'Circuito airbag frontale', causa: 'Modulo airbag, clock spring' },
};

export function OBDScansPage() {
  const { officina } = useAuthStore();
  const [scansioni, setScansioni] = useState<ScansioneOBD[]>([]);
  const [loading, setLoading] = useState(true);
  const [creandoApp, setCreandoApp] = useState<string | null>(null);

  const fetchScansioni = async () => {
    if (!officina) return;
    const { data } = await supabase
      .from('scansioni_obd')
      .select('*, clienti(nome,tel,email), veicoli(marca,modello,targa,anno,km)')
      .eq('officina_id', officina.id)
      .order('created_at', { ascending: false });
    setScansioni(data || []);
    setLoading(false);

    // Mark unread as read
    const unread = (data || []).filter(s => !s.letto).map(s => s.id);
    if (unread.length > 0) {
      await supabase.from('scansioni_obd').update({ letto: true }).in('id', unread);
    }
  };

  useEffect(() => {
    fetchScansioni();

    const channel = supabase
      .channel('obd-scans')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scansioni_obd' }, () => {
        fetchScansioni();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [officina]);

  const creaAppuntamento = async (scan: ScansioneOBD) => {
    if (!officina) return;
    setCreandoApp(scan.id);

    // Create appointment from scan
    await supabase.from('appuntamenti').insert({
      officina_id: officina.id,
      cliente_id: scan.cliente_id,
      veicolo_id: scan.veicolo_id,
      data_ora: new Date().toISOString(),
      stato: 'prenotato',
      priorita: 'normale',
      problema: `Scansione OBD: ${scan.codici.join(', ')}${scan.nota_cliente ? ` — ${scan.nota_cliente}` : ''}`,
      codici_obd: scan.codici.join(', '),
    });

    // Mark as handled
    await supabase.from('scansioni_obd').update({ gestito: true }).eq('id', scan.id);
    setCreandoApp(null);
    fetchScansioni();
  };

  const segnaGestito = async (id: string) => {
    await supabase.from('scansioni_obd').update({ gestito: true }).eq('id', id);
    fetchScansioni();
  };

  if (loading) return <Loader text="Caricamento scansioni..." />;

  const nonGestite = scansioni.filter(s => !s.gestito);
  const gestite = scansioni.filter(s => s.gestito);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Scansioni OBD ricevute</h2>

      {scansioni.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔌</div>
          <h3 className="text-lg font-semibold text-gray-900">Nessuna scansione</h3>
          <p className="text-sm text-gray-500 mt-1">
            Quando i clienti scansioneranno i codici OBD, li vedrai qui
          </p>
        </div>
      ) : (
        <>
          {/* Pending scans */}
          {nonGestite.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-700">Da gestire ({nonGestite.length})</span>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>

              {nonGestite.map((scan) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  onCreaAppuntamento={() => creaAppuntamento(scan)}
                  onSegnaGestito={() => segnaGestito(scan.id)}
                  loading={creandoApp === scan.id}
                  highlight
                />
              ))}
            </div>
          )}

          {/* Handled scans */}
          {gestite.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-500">Gestite ({gestite.length})</div>
              {gestite.slice(0, 10).map((scan) => (
                <ScanCard key={scan.id} scan={scan} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScanCard({ scan, onCreaAppuntamento, onSegnaGestito, loading, highlight }: {
  scan: ScansioneOBD;
  onCreaAppuntamento?: () => void;
  onSegnaGestito?: () => void;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={`!p-4 ${highlight ? 'bg-red-50 !border-red-200' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-sm text-gray-900">{scan.clienti?.nome}</div>
          <div className="text-xs text-gray-500">
            {scan.veicoli?.marca} {scan.veicoli?.modello} — {scan.veicoli?.targa}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">{fmtData(scan.created_at)}</div>
          <div className="text-xs text-gray-400">{fmtOra(scan.created_at)}</div>
        </div>
      </div>

      {/* Codes */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {scan.codici.map((code) => {
          const info = OBD_DATABASE[code];
          return (
            <div key={code} className="group relative">
              <Badge
                color={code.startsWith('P') ? '#991b1b' : code.startsWith('C') ? '#92400e' : '#4338ca'}
                bg={code.startsWith('P') ? '#fee2e2' : code.startsWith('C') ? '#fef3c7' : '#e0e7ff'}
              >
                {code}
              </Badge>
              {info && (
                <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 p-2 bg-gray-900 text-white text-[10px] rounded-lg w-48 z-10">
                  <div className="font-semibold">{info.desc}</div>
                  <div className="text-gray-300 mt-0.5">{info.causa}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Code descriptions */}
      <div className="space-y-1 mb-2">
        {scan.codici.map((code) => {
          const info = OBD_DATABASE[code];
          return (
            <div key={code} className="text-xs text-gray-600">
              <span className="font-mono font-semibold text-red-600">{code}</span>
              {info ? `: ${info.desc}` : ' — codice non riconosciuto'}
            </div>
          );
        })}
      </div>

      {/* Client note */}
      {scan.nota_cliente && (
        <div className="bg-gray-50 rounded-lg p-2 mb-2">
          <div className="text-[10px] text-gray-400">Nota del cliente:</div>
          <div className="text-xs text-gray-700">{scan.nota_cliente}</div>
        </div>
      )}

      {/* Vehicle info */}
      <div className="flex gap-2 text-[10px] text-gray-400 mb-3">
        <span>Anno: {scan.veicoli?.anno}</span>
        <span>·</span>
        <span>{scan.veicoli?.km?.toLocaleString()} km</span>
        {scan.clienti?.tel && (
          <>
            <span>·</span>
            <a href={`tel:${scan.clienti.tel}`} className="text-blue-500 hover:underline">📞 {scan.clienti.tel}</a>
          </>
        )}
      </div>

      {/* Actions */}
      {highlight && (
        <div className="flex gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={onCreaAppuntamento}
            loading={loading}
          >
            📅 Crea appuntamento
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={onSegnaGestito}
          >
            ✓ Segna gestito
          </Button>
        </div>
      )}

      {!highlight && scan.gestito && (
        <Badge color="#065f46" bg="#d1fae5">✓ Gestito</Badge>
      )}
    </Card>
  );
}
