import { useState, useMemo } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Officina } from '@/types/database';

// ============================================
// Types
// ============================================

type SdiStato = 'non_inviata' | 'inviata' | 'accettata' | 'rifiutata';

interface FatturaRiga {
  tipo: 'manodopera' | 'ricambio';
  desc: string;
  qta: number;
  prezzo: number;
}

interface FatturaData {
  id: string;
  numero: string;
  data_emissione: string;
  cliente_nome: string;
  cliente_cf: string;
  righe: FatturaRiga[];
  subtotale: number;
  iva: number;
  totale: number;
  sdi_stato?: SdiStato;
  sdi_identificativo?: string;
  sdi_data_invio?: string;
}

interface FatturaElettronicaProps {
  fattura: FatturaData;
  officina: Officina | null;
  onUpdate?: (fattura: FatturaData) => void;
}

// ============================================
// SDI status config
// ============================================

const SDI_STATO_CONFIG: Record<SdiStato, { label: string; color: string; bg: string; icon: string }> = {
  non_inviata: { label: 'Non inviata', color: '#6b7280', bg: '#f3f4f6', icon: '⏳' },
  inviata: { label: 'Inviata a SDI', color: '#1e40af', bg: '#dbeafe', icon: '📨' },
  accettata: { label: 'Accettata', color: '#065f46', bg: '#d1fae5', icon: '✅' },
  rifiutata: { label: 'Rifiutata', color: '#991b1b', bg: '#fee2e2', icon: '❌' },
};

// ============================================
// XML Generation
// ============================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generaProgressivo(numero: string): string {
  // Extract numeric part from invoice number (e.g. FT-2026-001 -> 00001)
  const parts = numero.split('-');
  const seq = parts[parts.length - 1] || '00001';
  return seq.padStart(5, '0');
}

function generaFatturaPA(fattura: FatturaData, officina: Officina): string {
  const progressivo = generaProgressivo(fattura.numero);
  const dataEmissione = fattura.data_emissione.split('T')[0]; // YYYY-MM-DD format
  const righe = (fattura.righe || []) as FatturaRiga[];
  const aliquotaIVA = '22.00';

  // Determine client type: P.IVA (11 digits) or CF (16 chars)
  const clienteCf = fattura.cliente_cf || '';
  const isPartitaIva = /^\d{11}$/.test(clienteCf.trim());
  const isCF = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(clienteCf.trim());

  const lineeXml = righe.map((riga, idx) => {
    const prezzoTotale = (riga.qta * riga.prezzo).toFixed(2);
    return `
        <DettaglioLinee>
          <NumeroLinea>${idx + 1}</NumeroLinea>
          <Descrizione>${escapeXml(riga.desc)}</Descrizione>
          <Quantita>${riga.qta.toFixed(2)}</Quantita>
          <PrezzoUnitario>${riga.prezzo.toFixed(2)}</PrezzoUnitario>
          <PrezzoTotale>${prezzoTotale}</PrezzoTotale>
          <AliquotaIVA>${aliquotaIVA}</AliquotaIVA>
        </DettaglioLinee>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(officina.p_iva)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressivo}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(officina.p_iva)}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${escapeXml(officina.nome)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(officina.indirizzo)}</Indirizzo>
        <CAP>00000</CAP>
        <Comune>${escapeXml(officina.indirizzo.split(',').pop()?.trim() || '')}</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>${isPartitaIva ? `
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(clienteCf.trim())}</IdCodice>
        </IdFiscaleIVA>` : ''}${isCF ? `
        <CodiceFiscale>${escapeXml(clienteCf.trim())}</CodiceFiscale>` : ''}
        <Anagrafica>
          <Denominazione>${escapeXml(fattura.cliente_nome)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>-</Indirizzo>
        <CAP>00000</CAP>
        <Comune>-</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dataEmissione}</Data>
        <Numero>${escapeXml(fattura.numero)}</Numero>
        <ImportoTotaleDocumento>${fattura.totale.toFixed(2)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${lineeXml}
      <DatiRiepilogo>
        <AliquotaIVA>${aliquotaIVA}</AliquotaIVA>
        <ImponibileImporto>${fattura.subtotale.toFixed(2)}</ImponibileImporto>
        <Imposta>${fattura.iva.toFixed(2)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <ImportoPagamento>${fattura.totale.toFixed(2)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

  return xml;
}

// ============================================
// Validation
// ============================================

interface Warning {
  campo: string;
  messaggio: string;
}

function validaFattura(fattura: FatturaData, officina: Officina | null): Warning[] {
  const warnings: Warning[] = [];

  if (!officina?.p_iva) {
    warnings.push({ campo: 'P.IVA Officina', messaggio: 'La Partita IVA dell\'officina non e\' configurata' });
  }
  if (!officina?.nome) {
    warnings.push({ campo: 'Denominazione', messaggio: 'Il nome dell\'officina non e\' configurato' });
  }
  if (!officina?.indirizzo) {
    warnings.push({ campo: 'Indirizzo', messaggio: 'L\'indirizzo dell\'officina non e\' configurato' });
  }
  if (!fattura.cliente_cf) {
    warnings.push({ campo: 'CF/P.IVA Cliente', messaggio: 'Il codice fiscale o la P.IVA del cliente non sono presenti' });
  } else {
    const cf = fattura.cliente_cf.trim();
    const isPartitaIva = /^\d{11}$/.test(cf);
    const isCF = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(cf);
    if (!isPartitaIva && !isCF) {
      warnings.push({ campo: 'CF/P.IVA Cliente', messaggio: 'Il formato del codice fiscale o della P.IVA non sembra valido' });
    }
  }
  if (!fattura.cliente_nome) {
    warnings.push({ campo: 'Nome Cliente', messaggio: 'Il nome del cliente e\' obbligatorio' });
  }
  if (!fattura.righe || fattura.righe.length === 0) {
    warnings.push({ campo: 'Righe', messaggio: 'La fattura non contiene righe' });
  }

  return warnings;
}

// ============================================
// Component
// ============================================

export function FatturaElettronica({ fattura, officina, onUpdate }: FatturaElettronicaProps) {
  const [xmlContent, setXmlContent] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sdiStato: SdiStato = (fattura.sdi_stato as SdiStato) || 'non_inviata';
  const statoCfg = SDI_STATO_CONFIG[sdiStato];

  const warnings = useMemo(
    () => validaFattura(fattura, officina),
    [fattura, officina],
  );

  const hasBlockingErrors = warnings.some(
    (w) => w.campo === 'P.IVA Officina' || w.campo === 'Righe',
  );

  // ---- Actions ----

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const generaXml = () => {
    if (!officina) return;
    const xml = generaFatturaPA(fattura, officina);
    setXmlContent(xml);
    showToast('XML FatturaPA generato con successo');
  };

  const scaricaXml = () => {
    if (!xmlContent) {
      showToast('Genera prima l\'XML');
      return;
    }

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Naming convention: IT + P.IVA + _ + progressivo.xml
    const piva = officina?.p_iva || '00000000000';
    const progressivo = generaProgressivo(fattura.numero);
    a.download = `IT${piva}_${progressivo}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('File XML scaricato');
  };

  const inviaSDI = async () => {
    if (!xmlContent) {
      showToast('Genera prima l\'XML');
      return;
    }

    setSending(true);

    // Mock SDI submission - simulate network delay
    await new Promise((r) => setTimeout(r, 1500));

    const identificativo = `SDI-${Date.now().toString(36).toUpperCase()}`;
    const dataInvio = new Date().toISOString();

    const { data, error } = await supabase
      .from('fatture')
      .update({
        sdi_stato: 'inviata',
        sdi_identificativo: identificativo,
        sdi_data_invio: dataInvio,
      })
      .eq('id', fattura.id)
      .select()
      .single();

    setSending(false);
    // Il messaggio di invio riuscito compariva anche quando l'aggiornamento
    // falliva, facendo credere che la fattura fosse partita.
    if (error || !data) {
      showToast('Invio non registrato: ' + (error?.message || 'nessuna riga aggiornata'));
      return;
    }
    if (onUpdate) onUpdate(data as FatturaData);
    showToast('Fattura inviata al Sistema di Interscambio');
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <Card className="!p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-900">Fattura Elettronica (SDI)</h3>
          <Badge color={statoCfg.color} bg={statoCfg.bg}>
            {statoCfg.icon} {statoCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          Formato FatturaPA v1.2 per il Sistema di Interscambio
        </p>

        {/* SDI identification info */}
        {fattura.sdi_identificativo && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">ID SDI:</span> {fattura.sdi_identificativo}
            </p>
            {fattura.sdi_data_invio && (
              <p className="text-xs text-blue-600 mt-0.5">
                <span className="font-semibold">Data invio:</span>{' '}
                {new Date(fattura.sdi_data_invio).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="!p-3 border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">Attenzione - Campi da verificare</p>
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="mt-0.5">&#9888;</span>
                <div>
                  <span className="font-medium">{w.campo}:</span> {w.messaggio}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={generaXml}
          disabled={hasBlockingErrors}
        >
          Genera XML
        </Button>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={scaricaXml}
            disabled={!xmlContent}
            className="flex-1"
          >
            Scarica XML
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={inviaSDI}
            loading={sending}
            disabled={!xmlContent || sdiStato === 'inviata' || sdiStato === 'accettata'}
            className="flex-1"
          >
            Invia a SDI
          </Button>
        </div>
      </div>

      {/* XML Preview */}
      {xmlContent && (
        <Card className="!p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Anteprima XML FatturaPA</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(xmlContent);
                showToast('XML copiato negli appunti');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Copia
            </button>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] leading-relaxed text-gray-700 overflow-x-auto max-h-80 overflow-y-auto font-mono whitespace-pre">
            {xmlContent}
          </pre>
        </Card>
      )}

      {/* Summary table */}
      <Card className="!p-3 bg-gray-50">
        <p className="text-xs font-semibold text-gray-700 mb-2">Riepilogo documento</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Tipo documento</span><span className="font-medium">TD01 - Fattura</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Numero</span><span className="font-medium">{fattura.numero}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Righe</span><span className="font-medium">{(fattura.righe || []).length}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Imponibile</span><span className="font-medium">{fmtEuro(fattura.subtotale)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>IVA 22%</span><span className="font-medium">{fmtEuro(fattura.iva)}</span>
          </div>
          <div className="flex justify-between text-gray-900 font-bold pt-1 border-t border-gray-200">
            <span>Totale</span><span>{fmtEuro(fattura.totale)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Divisa</span><span className="font-medium">EUR</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
