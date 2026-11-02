import { escapeHtml } from '@/lib/format';
import type { Officina } from '@/types/database';

// Stesse voci di LAVORAZIONI_TIPICHE in AppointmentDetail.tsx: duplicate qui
// (invece di importarle) per non tirare dentro tutto quel file, molto piu'
// pesante, solo per una lista di etichette testuali.
const LAVORAZIONI_TIPICHE = [
  'Tagliando',
  'Cambio olio e filtri',
  'Cambio pastiglie freni',
  'Cambio dischi freni',
  'Cambio gomme',
  'Cambio batteria',
  'Cambio cinghia distribuzione',
  'Diagnosi elettronica',
  'Revisione',
  'Allineamento/convergenza',
];

/**
 * Modulo cartaceo vuoto (accettazione + scheda lavoro insieme) da
 * stampare e compilare a mano al banco, per quando non conviene usare il
 * tablet (es. cliente di passaggio, officina piena). Nessun dato gia'
 * scritto: solo righe bianche su cui scrivere, stesso stile grafico degli
 * altri moduli stampabili dell'app.
 */
export function buildSchedaVuotaHtml(officina?: Officina | null): string {
  const riga = (larghezza = '1fr') => `<span class="riga" style="flex:${larghezza}"></span>`;
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Scheda di accettazione e lavoro — ${escapeHtml(officina?.nome || 'OfficinAI')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;padding:34px;color:#222;font-size:13.5px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:8px;border-bottom:3px solid #1a56db}
.header h1{color:#1a56db;font-size:17px}
.header p{color:#666;font-size:10.5px}
.titolo{text-align:right}
.titolo strong{font-size:14px;color:#1a56db}
.section{margin-bottom:16px}
.section h2{font-size:11.5px;color:#1a56db;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #ddd}
.campi{display:flex;flex-wrap:wrap;gap:8px 20px}
.campo{display:flex;align-items:baseline;gap:6px;flex:1 1 auto}
.campo label{color:#888;white-space:nowrap;font-size:11px}
.riga{display:inline-block;border-bottom:1px solid #999;min-height:14px;flex:1}
.righe-box{border:1px solid #ddd;border-radius:6px;padding:8px 10px}
.righe-box .riga-libera{border-bottom:1px solid #e0e0e0;height:22px}
.righe-box .riga-libera:last-child{border-bottom:none}
.checklist{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}
.check{display:flex;align-items:center;gap:5px;font-size:11px}
.box{width:12px;height:12px;border:2px solid #333;border-radius:3px;flex-shrink:0}
table.difetti{width:100%;border-collapse:collapse}
table.difetti th{background:#f3f4f6;font-size:10px;text-transform:uppercase;color:#888;text-align:left;padding:4px 6px;border-bottom:1px solid #ddd}
table.difetti td{padding:9px 6px;border-bottom:1px solid #eee;font-size:11.5px}
table.difetti .gravita{white-space:nowrap}
.firme{margin-top:16px;display:flex;justify-content:space-between;gap:16px}
.firma-box{text-align:center;flex:1}
.firma-box .line{border-bottom:1px solid #333;height:38px;margin-bottom:4px}
.firma-box p{font-size:10px;color:#666}
@media print{body{padding:10px}}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>${escapeHtml(officina?.nome || 'OfficinAI')}</h1>
    <p>${escapeHtml(officina?.indirizzo || '')}</p>
    <p>Tel: ${escapeHtml(officina?.tel || '')}${officina?.email ? ` · Email: ${escapeHtml(officina.email)}` : ''}</p>
  </div>
  <div class="titolo">
    <strong>SCHEDA DI ACCETTAZIONE<br>E LAVORO</strong><br>
    <span style="font-size:10.5px;color:#666">Data: ${riga('60px')}&nbsp;&nbsp;N°: ${riga('60px')}</span>
  </div>
</div>

<div class="section">
  <h2>Dati cliente e veicolo</h2>
  <div class="campi">
    <div class="campo" style="flex-basis:60%"><label>Cliente</label>${riga()}</div>
    <div class="campo" style="flex-basis:35%"><label>Telefono</label>${riga()}</div>
    <div class="campo" style="flex-basis:45%"><label>Marca/Modello</label>${riga()}</div>
    <div class="campo" style="flex-basis:25%"><label>Targa</label>${riga()}</div>
    <div class="campo" style="flex-basis:20%"><label>Km</label>${riga()}</div>
    <div class="campo" style="flex-basis:18%"><label>Anno</label>${riga()}</div>
    <div class="campo" style="flex-basis:35%"><label>Carburante</label>${riga()}</div>
  </div>
</div>

<div class="section">
  <h2>Problema riportato dal cliente</h2>
  <div class="righe-box">
    <div class="riga-libera"></div>
    <div class="riga-libera"></div>
    <div class="riga-libera"></div>
  </div>
</div>

<div class="section">
  <h2>Lavorazioni tipiche</h2>
  <div class="checklist">
    ${LAVORAZIONI_TIPICHE.map((v) => `<div class="check"><span class="box"></span>${escapeHtml(v)}</div>`).join('')}
    <div class="check"><span class="box"></span>${riga()}</div>
    <div class="check"><span class="box"></span>${riga()}</div>
  </div>
</div>

<div class="section">
  <h2>Lavorazioni da eseguire</h2>
  <div class="righe-box">
    <div class="riga-libera"></div>
    <div class="riga-libera"></div>
    <div class="riga-libera"></div>
    <div class="riga-libera"></div>
  </div>
</div>

<div class="section">
  <h2>Difetti riscontrati</h2>
  <table class="difetti">
    <thead><tr><th>Descrizione</th><th class="gravita">Gravità</th><th>Risolto</th></tr></thead>
    <tbody>
      ${Array.from({ length: 5 }).map(() => `
      <tr>
        <td>&nbsp;</td>
        <td class="gravita">Bassa ☐ &nbsp; Media ☐ &nbsp; Alta ☐</td>
        <td>Sì ☐ &nbsp; No ☐</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="firme">
  <div class="firma-box"><div class="line"></div><p>Nome cliente</p></div>
  <div class="firma-box"><div class="line"></div><p>Operaio</p></div>
  <div class="firma-box"><div class="line"></div><p>Firma cliente</p></div>
  <div class="firma-box"><div class="line"></div><p>Firma operaio</p></div>
</div>

</body>
</html>`;
}

/** Apre il modulo vuoto in una nuova finestra, pronto per la stampa. */
export function stampaSchedaVuota(officina?: Officina | null): void {
  const html = buildSchedaVuotaHtml(officina);
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
}
