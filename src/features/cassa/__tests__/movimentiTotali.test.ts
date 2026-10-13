import { describe, it, expect } from 'vitest';
import { incassoMovimento, spesaMovimento, spesaRicambi, creditoFornitoreDiretto } from '../movimentiTotali';
import type { Movimento, PagamentoInfo } from '@/types/database';

function movimento(overrides: Partial<Movimento> = {}): Movimento {
  return {
    id: 'm1',
    officina_id: 'o1',
    tipo: 'spesa_revisione_gianni',
    importo: 0,
    descrizione: 'Scatola sterzo',
    data: '2026-01-10',
    ...overrides,
  };
}

describe('incassoMovimento / spesaMovimento — Revisione Gianni / Centraline Daniele', () => {
  it('in lavorazione non conta ne come incasso ne come spesa: i numeri finali si sanno solo a fine lavoro', () => {
    const m = movimento({ stato: 'in_lavorazione', importo: 0, spese_lavorazione: null });
    expect(incassoMovimento(m)).toBe(0);
    expect(spesaMovimento(m)).toBe(0);
  });

  it("completata: incasso e' importo, spesa e' spese_lavorazione quando il quadratino conta come spesa e' spuntato", () => {
    const m = movimento({ stato: 'completato', importo: 160, spese_lavorazione: 60, spese_lavorazione_conta: true });
    expect(incassoMovimento(m)).toBe(160);
    expect(spesaMovimento(m)).toBe(60);
  });

  it("quadratino non spuntato: la spesa lavorazione non conta come costo (la paga di tasca sua il collaboratore)", () => {
    const m = movimento({ stato: 'completato', importo: 160, spese_lavorazione: 60, spese_lavorazione_conta: false });
    expect(incassoMovimento(m)).toBe(160); // l'incasso dal cliente resta comunque intero
    expect(spesaMovimento(m)).toBe(0);
  });

  it("quadratino assente (righe salvate prima che esistesse): conta come costo, per non cambiare lo storico di colpo", () => {
    const m = movimento({ stato: 'completato', importo: 160, spese_lavorazione: 60, spese_lavorazione_conta: undefined });
    expect(spesaMovimento(m)).toBe(60);
  });

  it('centraline Daniele si comporta identico a revisione Gianni', () => {
    const m = movimento({ tipo: 'spesa_centraline_daniele', stato: 'completato', importo: 90, spese_lavorazione: 20, spese_lavorazione_conta: true });
    expect(incassoMovimento(m)).toBe(90);
    expect(spesaMovimento(m)).toBe(20);
  });
});

describe('spesaMovimento — altri tipi di movimento (spese dirette)', () => {
  it('una spesa officina conta sempre come costo, per intero', () => {
    const m = movimento({ tipo: 'spesa_officina', importo: 200 });
    expect(spesaMovimento(m)).toBe(200);
  });

  it("un incasso extra non e' mai una spesa", () => {
    const m = movimento({ tipo: 'incasso_extra', importo: 100 });
    expect(spesaMovimento(m)).toBe(0);
    expect(incassoMovimento(m)).toBe(100);
  });
});

describe('spesaRicambi — costo ricambi su una consegna auto', () => {
  it("conta come spesa solo se pagati subito e' spuntato (es. sfascio pagato in contanti dall'officina)", () => {
    const p: PagamentoInfo = { stato: 'pagato', costo_ricambi: 80, ricambi_pagati_subito: true };
    expect(spesaRicambi(p)).toBe(80);
  });

  it("non conta come spesa se si paga a blocchi dopo (es. Autoricambi/Monti a debito)", () => {
    const p: PagamentoInfo = { stato: 'pagato', costo_ricambi: 80, ricambi_pagati_subito: false };
    expect(spesaRicambi(p)).toBe(0);
  });

  it("senza pagamento non c'e' nessun costo da contare", () => {
    expect(spesaRicambi(null)).toBe(0);
    expect(spesaRicambi(undefined)).toBe(0);
  });
});

describe('creditoFornitoreDiretto — quando il cliente paga il fornitore ricambi direttamente (es. Monti)', () => {
  it('non segnato: niente va al fornitore da qui', () => {
    const p: PagamentoInfo = { stato: 'pagato', fornitore_pagato_da_cliente: false, importo_totale: 210 };
    expect(creditoFornitoreDiretto(p)).toBe(0);
  });

  it("pagato completo: tutto l'importo e' finito al fornitore, l'officina non ha incassato nulla di suo", () => {
    const p: PagamentoInfo = { stato: 'pagato', fornitore_pagato_da_cliente: true, importo_totale: 210, importo_pagato: 210 };
    expect(creditoFornitoreDiretto(p)).toBe(210);
  });

  it("acconto: solo il resto (non ancora incassato) e' finito al fornitore", () => {
    const p: PagamentoInfo = { stato: 'acconto', fornitore_pagato_da_cliente: true, importo_totale: 210, importo_pagato: 50 };
    expect(creditoFornitoreDiretto(p)).toBe(160);
  });
});
