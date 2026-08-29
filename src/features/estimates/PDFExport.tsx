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
 * Estrae un colore "brand" dominante dal logo dell'officina, campionando
 * i pixel su un canvas e scartando bianco/nero/grigi (poca saturazione).
 * Ritorna il colore di default se il logo non e' disponibile o la lettura
 * dei pixel fallisce (es. CORS).
 */
async function extractLogoColor(logoUrl: string | null | undefined, fallback = '#1a56db'): Promise<string> {
  if (!logoUrl) return fallback;
  try {
    const color = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const size = 40;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);

          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const [pr, pg, pb, pa] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
            if (pa < 128) continue;
            const max = Math.max(pr, pg, pb);
            const min = Math.min(pr, pg, pb);
            const lightness = (max + min) / 2;
            const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
            // Scarta pixel troppo chiari, troppo scuri o poco saturi (bianco/nero/grigio)
            if (lightness > 235 || lightness < 20 || saturation < 0.15) continue;
            r += pr; g += pg; b += pb; count++;
          }
          if (count === 0) { resolve(null); return; }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          const toHex = (n: number) => n.toString(16).padStart(2, '0');
          resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
    return color || fallback;
  } catch {
    return fallback;
  }
}

/** Scurisce un colore hex di una percentuale (0-1) per ottenere una variante piu scura. */
function darkenColor(hex: string, amount = 0.2): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - amount)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Costruisce l'HTML del preventivo (standalone, pronto per stampa/upload).
 * Usato sia dal bottone "Esporta PDF" che dall'upload su Storage per condivisione.
 * `accentColor` (opzionale) sostituisce il blu di default con il colore del logo.
 */
export function buildPreventivoHtml(
  appuntamento: Appuntamento,
  preventivo: Preventivo,
  officina?: Officina | null,
  accentColor?: string
): string {
  const accent = accentColor || '#1a56db';
  const accentDark = darkenColor(accent, 0.15);
  const logoBlock = officina?.logo_url
    ? `<img src="${officina.logo_url}" alt="Logo" style="width:48px;height:48px;border-radius:10px;object-fit:cover;margin-right:12px;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preventivo — ${officina?.nome || 'OfficinAI'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; font-size: 13px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid ${accent}; }
    .header-left { display: flex; align-items: center; }
    .header-left h1 { color: ${accent}; font-size: 24px; margin-bottom: 4px; }
    .header-left p { color: #666; font-size: 12px; }
    .header-right { text-align: right; font-size: 12px; color: #666; }
    .header-right strong { color: #333; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; color: ${accent}; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-box { background: #f9fafb; padding: 12px; border-radius: 8px; }
    .info-box label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box p { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { background: ${accentDark}; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
    th:first-child { border-radius: 6px 0 0 0; }
    th:last-child { border-radius: 0 6px 0 0; text-align: right; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    td:last-child { text-align: right; font-weight: 600; }
    tr:nth-child(even) { background: #f9fafb; }
    .totals { margin-top: 16px; text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; }
    .totals .total { font-size: 18px; font-weight: 700; color: ${accent}; padding-top: 8px; border-top: 2px solid ${accent}; }
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
      ${logoBlock}
      <div>
        <h1>${officina?.nome || 'OfficinAI'}</h1>
        <p>${officina?.indirizzo || ''}</p>
        <p>Tel: ${officina?.tel || ''} • Email: ${officina?.email || ''}</p>
        <p>P.IVA: ${officina?.p_iva || ''}</p>
      </div>
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

export { extractLogoColor };

export function PDFExport({ appuntamento, preventivo }: PDFExportProps) {
  const { officina } = useAuthStore();
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    const accent = await extractLogoColor(officina?.logo_url);
    const html = buildPreventivoHtml(appuntamento, preventivo, officina, accent);

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
