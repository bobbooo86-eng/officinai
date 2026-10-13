import { describe, it, expect } from 'vitest';
import { incassato, restoDaIncassare, valoreLavoro } from '../IncassiOfficina';
import type { Appuntamento, PagamentoInfo } from '@/types/database';

function consegna(pagamento: PagamentoInfo | null, overrides: Partial<Appuntamento> = {}): Appuntamento {
  return {
    id: 'a1',
    officina_id: 'o1',
    cliente_id: 'c1',
    veicolo_id: 'v1',
    data_ora: '2026-01-10T10:00:00+00:00',
    stato: 'consegnato',
    priorita: 'normale',
    problema: 'Tagliando',
    pagamento,
    ...overrides,
  };
}

describe("incassato — quanto e' davvero in cassa per una consegna", () => {
  it('pagato completo: conta tutto il totale', () => {
    const a = consegna({ stato: 'pagato', importo_totale: 350, importo_pagato: 350 });
    expect(incassato(a)).toBe(350);
  });

  it("acconto: conta solo quanto gia' versato, non il totale", () => {
    const a = consegna({ stato: 'acconto', importo_totale: 350, importo_pagato: 100 });
    expect(incassato(a)).toBe(100);
  });

  it('non pagato: zero', () => {
    const a = consegna({ stato: 'non_pagato', importo_totale: 350 });
    expect(incassato(a)).toBe(0);
  });

  it("acconti presi prima della consegna (mentre l'auto era in lavorazione) non si ricontano alla consegna finale", () => {
    const a = consegna(
      { stato: 'pagato', importo_totale: 350, importo_pagato: 350 },
      { acconti: [{ data_acconto: '2026-01-05', importo: 100 }] }
    );
    expect(incassato(a)).toBe(250);
  });

  it("Autodemolizioni Monti, pagato completo: il cliente ha pagato Monti direttamente, l'officina non ha incassato nulla di suo", () => {
    const a = consegna({
      stato: 'pagato', importo_totale: 210, importo_pagato: 210,
      fornitore_pagato_da_cliente: true, fornitore_ricambi: 'monti',
    });
    expect(incassato(a)).toBe(0);
  });

  it('Monti, acconto: il cliente ha davvero anticipato una parte all\'officina, solo il resto e\' finito a Monti', () => {
    const a = consegna({
      stato: 'acconto', importo_totale: 210, importo_pagato: 50,
      fornitore_pagato_da_cliente: true, fornitore_ricambi: 'monti',
    });
    expect(incassato(a)).toBe(50);
  });
});

describe('restoDaIncassare — quanto manca ancora da farsi pagare', () => {
  it("acconto: resto e' totale meno versato", () => {
    const a = consegna({ stato: 'acconto', importo_totale: 350, importo_pagato: 100 });
    expect(restoDaIncassare(a)).toBe(250);
  });

  it("non pagato: resto e' tutto il totale", () => {
    const a = consegna({ stato: 'non_pagato', importo_totale: 350 });
    expect(restoDaIncassare(a)).toBe(350);
  });

  it('pagato completo: niente da incassare', () => {
    const a = consegna({ stato: 'pagato', importo_totale: 350, importo_pagato: 350 });
    expect(restoDaIncassare(a)).toBe(0);
  });

  it(
    'pagato dal cliente al fornitore direttamente (Renegade/Monti): resto deve essere sempre 0, ' +
      "anche se e' ancora segnato acconto o non pagato — non e' l'officina a doverlo incassare",
    () => {
      const inAcconto = consegna({
        stato: 'acconto', importo_totale: 210, importo_pagato: 50,
        fornitore_pagato_da_cliente: true, fornitore_ricambi: 'monti',
      });
      expect(restoDaIncassare(inAcconto)).toBe(0);

      const nonPagato = consegna({
        stato: 'non_pagato', importo_totale: 210,
        fornitore_pagato_da_cliente: true, fornitore_ricambi: 'monti',
      });
      expect(restoDaIncassare(nonPagato)).toBe(0);
    }
  );
});

describe('valoreLavoro — il valore del lavoro fatto, incassato o no', () => {
  it("un'auto consegnata e non pagata conta comunque per intero: il lavoro e' stato fatto", () => {
    const a = consegna({ stato: 'non_pagato', importo_totale: 280 });
    expect(valoreLavoro(a)).toBe(280);
  });

  it('senza un totale registrato vale zero (non un errore)', () => {
    const a = consegna({ stato: 'non_pagato' });
    expect(valoreLavoro(a)).toBe(0);
  });
});
