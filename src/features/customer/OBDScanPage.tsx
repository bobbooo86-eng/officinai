import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Veicolo } from '@/types/database';

// ELM327 BLE typical service/characteristic UUIDs
const ELM_SERVICE_UUIDS = [
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const TX_CHAR_UUIDS = [
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

const RX_CHAR_UUIDS = [
  '0000fff2-0000-1000-8000-00805f9b34fb',
  '0000ffe2-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

type ScanStep = 'select' | 'connect' | 'scanning' | 'sending' | 'done' | 'error' | 'no-bluetooth';

interface Props {
  veicoli: Veicolo[];
}

export function OBDScanPage({ veicoli }: Props) {
  const { cliente } = useAuthStore();
  const [step, setStep] = useState<ScanStep>('select');
  const [selectedVeicolo, setSelectedVeicolo] = useState<string>(veicoli[0]?.id || '');
  const [statusText, setStatusText] = useState('');
  const [codiciTrovati, setCodiciTrovati] = useState<string[]>([]);
  const [notaCliente, setNotaCliente] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const parseDTCFromResponse = (raw: string): string[] => {
    const codes: string[] = [];
    // Remove spaces and clean response
    const cleaned = raw.replace(/[\r\n\s>]/g, '').toUpperCase();

    // Mode 03 response starts with "43"
    // Format: 43 XX YY where XX YY form one DTC
    const hexPairs = cleaned.replace(/^43/, '').match(/.{1,4}/g) || [];

    for (const pair of hexPairs) {
      if (pair === '0000' || pair.length < 4) continue;

      const firstChar = parseInt(pair[0], 16);
      const prefix = ['P', 'C', 'B', 'U'][firstChar >> 2] || 'P';
      const secondDigit = (firstChar & 0x03).toString();
      const rest = pair.slice(1);
      const code = `${prefix}${secondDigit}${rest}`;

      if (code.match(/^[PCBU]\d{4}$/)) {
        codes.push(code);
      }
    }

    return [...new Set(codes)];
  };

  const startScan = async () => {
    if (!hasBluetooth) {
      setStep('no-bluetooth');
      return;
    }

    setStep('connect');
    setStatusText('Ricerca adattatore OBD...');
    setCodiciTrovati([]);
    setErrorMsg('');

    try {
      // Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        filters: ELM_SERVICE_UUIDS.map(uuid => ({ services: [uuid] })),
        optionalServices: ELM_SERVICE_UUIDS,
      });

      setStatusText(`Connessione a ${device.name || 'OBD'}...`);
      const server = await device.gatt!.connect();

      // Find the right service
      let txChar: BluetoothRemoteGATTCharacteristic | null = null;
      let rxChar: BluetoothRemoteGATTCharacteristic | null = null;

      for (const svcUuid of ELM_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(svcUuid);
          for (const txUuid of TX_CHAR_UUIDS) {
            try { txChar = await service.getCharacteristic(txUuid); break; } catch {}
          }
          for (const rxUuid of RX_CHAR_UUIDS) {
            try { rxChar = await service.getCharacteristic(rxUuid); break; } catch {}
          }
          if (txChar) break;
        } catch {}
      }

      if (!txChar) {
        throw new Error('Caratteristiche BLE non trovate. Verifica che l\'adattatore sia ELM327 BLE.');
      }

      // If TX and RX are the same characteristic (common in some adapters)
      if (!rxChar) rxChar = txChar;

      const encoder = new TextEncoder();
      const sendCommand = async (cmd: string): Promise<string> => {
        await txChar!.writeValue(encoder.encode(cmd + '\r'));
        // Wait for response
        await new Promise(r => setTimeout(r, 1000));
        const value = await rxChar!.readValue();
        const decoder = new TextDecoder();
        return decoder.decode(value);
      };

      setStep('scanning');
      setStatusText('Inizializzazione adattatore...');

      // Initialize ELM327
      await sendCommand('ATZ');   // Reset
      await new Promise(r => setTimeout(r, 1500));
      await sendCommand('ATE0');  // Echo off
      await sendCommand('ATL0');  // Linefeeds off
      await sendCommand('ATS0');  // Spaces off
      await sendCommand('ATSP0'); // Auto protocol

      setStatusText('Lettura codici errore...');

      // Read DTCs (Mode 03)
      const response = await sendCommand('03');
      const codes = parseDTCFromResponse(response);

      // Also try pending codes (Mode 07)
      setStatusText('Lettura codici pendenti...');
      const pendingResponse = await sendCommand('07');
      const pendingCodes = parseDTCFromResponse(pendingResponse);

      const allCodes = [...new Set([...codes, ...pendingCodes])];
      setCodiciTrovati(allCodes);

      // Disconnect
      device.gatt!.disconnect();

      if (allCodes.length === 0) {
        setStatusText('Nessun codice errore trovato!');
      } else {
        setStatusText(`Trovati ${allCodes.length} codici errore`);
      }

      // Send to officina
      await sendToOfficina(allCodes);

    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setErrorMsg('Nessun adattatore OBD trovato. Assicurati che sia collegato e acceso.');
      } else {
        setErrorMsg(err.message || 'Errore durante la scansione');
      }
      setStep('error');
    }
  };

  // Manual code entry fallback
  const [manualCodes, setManualCodes] = useState('');

  const sendManualCodes = async () => {
    const codes = manualCodes
      .toUpperCase()
      .split(/[,;\s]+/)
      .filter(c => c.match(/^[PCBU]\d{4}$/));

    if (codes.length === 0) return;

    setCodiciTrovati(codes);
    await sendToOfficina(codes);
  };

  const sendToOfficina = async (codes: string[]) => {
    if (!cliente) return;
    setStep('sending');
    setStatusText('Invio dati all\'officina...');

    await supabase.from('scansioni_obd').insert({
      officina_id: cliente.officina_id,
      cliente_id: cliente.id,
      veicolo_id: selectedVeicolo,
      codici: codes,
      nota_cliente: notaCliente.trim() || null,
      letto: false,
      gestito: false,
    });

    setStep('done');
  };

  // ---- Vehicle selection ----
  if (step === 'select') {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Scansione OBD</h2>

        <Card className="!p-4 bg-violet-50 border-violet-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">🔌</div>
            <div>
              <div className="text-sm font-semibold text-violet-900">Come funziona</div>
              <div className="text-xs text-violet-700">
                1. Collega l'adattatore OBD alla presa sotto il volante<br />
                2. Accendi il quadro (chiave su ON, motore spento)<br />
                3. Premi "Avvia scansione" qui sotto
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">Seleziona il veicolo:</p>
          {veicoli.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVeicolo(v.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedVeicolo === v.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🚗</div>
                <div>
                  <div className="font-semibold text-gray-900">{v.marca} {v.modello}</div>
                  <div className="text-xs text-gray-500">{v.targa} · {v.anno} · {v.km?.toLocaleString()} km</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrivi il problema (opzionale)</label>
          <textarea
            value={notaCliente}
            onChange={(e) => setNotaCliente(e.target.value)}
            placeholder="Es: La spia motore si è accesa stamattina, l'auto vibra al minimo..."
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            rows={3}
          />
        </div>

        {hasBluetooth ? (
          <Button
            fullWidth
            onClick={startScan}
            disabled={!selectedVeicolo}
            className="!bg-violet-600 hover:!bg-violet-700"
          >
            🔌 Avvia scansione Bluetooth
          </Button>
        ) : (
          <Card className="!p-3 bg-amber-50 border-amber-200">
            <div className="text-xs text-amber-800 mb-2">
              Il tuo browser non supporta il Bluetooth. Puoi inserire i codici manualmente.
            </div>
          </Card>
        )}

        {/* Manual fallback always visible */}
        <Card className="!p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Inserimento manuale codici</div>
          <div className="text-xs text-gray-400 mb-2">
            Se hai un'app OBD separata, puoi inserire i codici qui
          </div>
          <input
            value={manualCodes}
            onChange={(e) => setManualCodes(e.target.value)}
            placeholder="Es: P0300, P0171, P0420"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
          />
          <Button
            fullWidth
            variant="secondary"
            onClick={sendManualCodes}
            disabled={!manualCodes.trim() || !selectedVeicolo}
          >
            Invia codici all'officina
          </Button>
        </Card>
      </div>
    );
  }

  // ---- Connecting / Scanning ----
  if (step === 'connect' || step === 'scanning' || step === 'sending') {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-4xl">{step === 'sending' ? '📤' : '🔌'}</span>
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-violet-300 border-t-violet-600 animate-spin" />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">{statusText}</div>
          <div className="text-xs text-gray-400 mt-1">Non scollegare l'adattatore</div>
        </div>
      </div>
    );
  }

  // ---- Done ----
  if (step === 'done') {
    return (
      <div className="p-4 text-center py-16 space-y-4">
        <div className="text-5xl mb-2">{codiciTrovati.length > 0 ? '📩' : '✅'}</div>
        <h2 className="text-xl font-bold text-gray-900">
          {codiciTrovati.length > 0 ? 'Scansione inviata!' : 'Nessun errore trovato!'}
        </h2>

        {codiciTrovati.length > 0 ? (
          <>
            <p className="text-sm text-gray-500">
              {codiciTrovati.length} codici errore inviati all'officina
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {codiciTrovati.map((c) => (
                <span key={c} className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-mono font-semibold">
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              L'officina analizzerà i codici e ti contatterà per un appuntamento
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            La tua auto non ha codici errore memorizzati. Se il problema persiste, contatta l'officina.
          </p>
        )}

        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => { setStep('select'); setCodiciTrovati([]); setManualCodes(''); setNotaCliente(''); }}
        >
          Nuova scansione
        </Button>
      </div>
    );
  }

  // ---- No Bluetooth ----
  if (step === 'no-bluetooth') {
    return (
      <div className="p-4 text-center py-16 space-y-4">
        <div className="text-5xl mb-2">📵</div>
        <h2 className="text-lg font-bold text-gray-900">Bluetooth non disponibile</h2>
        <p className="text-sm text-gray-500">
          Il tuo browser non supporta Web Bluetooth.<br />
          Usa Google Chrome su Android o computer per la scansione automatica.
        </p>
        <Button variant="secondary" onClick={() => setStep('select')}>
          Torna indietro
        </Button>
      </div>
    );
  }

  // ---- Error ----
  if (step === 'error') {
    return (
      <div className="p-4 text-center py-16 space-y-4">
        <div className="text-5xl mb-2">⚠️</div>
        <h2 className="text-lg font-bold text-gray-900">Errore scansione</h2>
        <p className="text-sm text-red-600">{errorMsg}</p>
        <p className="text-xs text-gray-400">
          Verifica che l'adattatore OBD sia collegato e il quadro acceso
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={startScan}>Riprova</Button>
          <Button variant="secondary" onClick={() => setStep('select')}>
            Inserisci manualmente
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
