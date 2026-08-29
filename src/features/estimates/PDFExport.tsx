import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento, Officina, Preventivo } from '@/types/database';

interface PDFExportProps {
  appuntamento: Appuntamento;
  preventivo: Preventivo;
}

/**
 * Costruisce l'HTML del preventivo (standalone, pronto per stampa/upload).
 * Usato sia dal bottone "Esporta PDF" che dall'upload su Storage per condivisione.
 */
export function buildPreventivoHtml(
  appuntamento: Appuntamento,
  preventivo: Preventivo,
  officina?: Officina | null
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preventivo — ${officina?.nome || 'OfficinAI'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; font-size: 13px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #1a56db; }
    .header-left h1 { color: #1a56db; font-size: 24px; margin-bottom: 4px; }
    .header-left p { color: #666; font-size: 12px; }
    .header-right { text-align: right; font-size: 12px; color: #666; }
    .header-right strong { color: #333; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; color: #1a56db; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-box { background: #f9fafb; padding: 12px; border-radius: 8px; }
    .info-box label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box p { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { background: #1f2937; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
    th:first-child { border-radius: 6px 0 0 0; }
    th:last-child { border-radius: 0 6px 0 0; text-align: right; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    td:last-child { text-align: right; font-weight: 600; }
    tr:nth-child(even) { background: #f9fafb; }
    .totals { margin-top: 16px; text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; }
    .totals .total { font-size: 18px; font-weight: 700; color: #1a56db; padding-top: 8px; border-top: 2px solid #1a56db; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-mano { background: #dbeafe; color: #1e40af; }
    .badge-ric { background: #fef3c7; color: #92400e; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>🔧 ${officina?.nome || 'OfficinAI'}</h1>
      <p>${officina?.indirizzo || ''}</p>
      <p>Tel: ${officina?.tel || ''} • Email: ${officina?.email || ''}</p>
      <p>P.IVA: ${officina?.p_iva || ''}</p>
    </div>
    <div class="header-right">
      <strong>PREVENTIVO</strong><br>
      Data: ${new Date().toLocaleDateString('it-IT')}<br>
      Stato: ${preventivo.stato.toUpperCase()}
    </div>
  </div>

  <div class="section">
    <h2>Dati cliente e veicolo</h2>
    <div class="info-grid">
      <div class="info-box">
        <label>Cliente</label>
        <p>${appuntamento.clienti?.nome || '-'}</p>
      </div>
      <div class="info-box">
        <label>Veicolo</label>
        <p>${appuntamento.veicoli?.marca} ${appuntamento.veicoli?.modello} — ${appuntamento.veicoli?.targa}</p>
      </div>
      <div class="info-box">
        <label>Problema segnalato</label>
        <p>${appuntamento.problema}</p>
      </div>
      <div class="info-box">
        <label>Km</label>
        <p>${appuntamento.veicoli?.km?.toLocaleString() || '-'}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Dettaglio preventivo</h2>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Descrizione</th>
          <th>Qtà</th>
          <th>Prezzo</th>
          <th>Totale</th>
        </tr>
      </thead>
      <tbody>
        ${(preventivo.righe || []).map((r) => `
          <tr>
            <td><span class="badge ${r.tipo === 'manodopera' ? 'badge-mano' : 'badge-ric'}">${r.tipo === 'manodopera' ? 'Manodopera' : 'Ricambio'}</span></td>
            <td>${r.desc}</td>
            <td>${r.qta}</td>
            <td>${fmtEuro(r.prezzo)}</td>
            <td>${fmtEuro(r.qta * r.prezzo)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotale:</span> <strong>${fmtEuro(preventivo.subtotale)}</strong></div>
      ${preventivo.sconto > 0 ? `<div class="row"><span>Sconto:</span> <strong>-${fmtEuro(preventivo.sconto)}</strong></div>` : ''}
      <div class="row"><span>IVA 22%:</span> <strong>${fmtEuro(preventivo.iva)}</strong></div>
      <div class="row total"><span>TOTALE:</span> <strong>${fmtEuro(preventivo.totale)}</strong></div>
    </div>
  </div>

  <div class="section">
    <h2>Condizioni</h2>
    <p style="font-size: 11px; color: #666; line-height: 1.6;">
      Il presente preventivo ha validità 30 giorni dalla data di emissione.
      I prezzi dei ricambi possono subire variazioni in base alla disponibilità.
      I tempi di lavorazione sono stimati e possono variare in base alle condizioni effettive del veicolo.
    </p>
  </div>

  <div class="footer">
    <p>${officina?.nome || 'OfficinAI'} • ${officina?.indirizzo || ''} • P.IVA ${officina?.p_iva || ''}</p>
    <p style="margin-top: 4px;">Documento generato con OfficinAI — officinai.app</p>
  </div>
</body>
</html>`;
}

export function PDFExport({ appuntamento, preventivo }: PDFExportProps) {
  const { officina } = useAuthStore();
  const [generating, setGenerating] = useState(false);

  const generatePDF = () => {
    setGenerating(true);
    const html = buildPreventivoHtml(appuntamento, preventivo, officina);

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    setGenerating(false);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={generatePDF}
      loading={generating}
    >
      📄 Esporta PDF
    </Button>
  );
}
