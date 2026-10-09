import type { Veicolo } from '@/types/database';

// ============================================================
// TARIFFARIO STANDARD OFFICINE ITALIANE
// Prezzi medi 2024-2026 per autovetture segmento B/C
//
// Condiviso fra il builder preventivi standalone (PreventiviPage) e il
// preventivo dentro la scheda di un appuntamento (AppointmentDetail):
// prima solo il primo aveva le voci preimpostate, il secondo partiva
// sempre vuoto.
// ============================================================

export interface VoceTariffario {
  id: string;
  categoria: string;
  nome: string;
  descrizione: string;
  manodopera: { ore: number; prezzoOra: number };
  ricambi: { nome: string; prezzoMin: number; prezzoMax: number }[];
}

// Categorie del tariffario
export const CATEGORIE_TARIFFARIO = [
  'Tagliando & Manutenzione',
  'Freni',
  'Motore',
  'Distribuzione',
  'Sospensioni & Sterzo',
  'Scarico & Emissioni',
  'Climatizzazione',
  'Elettrico & Batteria',
  'Trasmissione & Frizione',
  'Carrozzeria & Vetri',
  'Pneumatici',
  'Diagnosi',
] as const;

// Prezzo ora manodopera medio Italia per segmento
export const PREZZO_ORA: Record<string, number> = {
  utilitaria: 38,
  media: 45,
  premium: 60,
  commerciale: 42,
  suv: 50,
};

function getSegmento(marca: string): string {
  const m = marca.toLowerCase();
  if (['fiat', 'dacia', 'citroen', 'peugeot', 'opel', 'renault', 'seat', 'skoda', 'hyundai', 'kia', 'suzuki', 'lancia'].includes(m)) return 'utilitaria';
  if (['volkswagen', 'ford', 'toyota', 'nissan', 'honda', 'mazda', 'mitsubishi', 'subaru'].includes(m)) return 'media';
  if (['bmw', 'audi', 'mercedes', 'alfa romeo', 'volvo', 'lexus', 'mini', 'tesla', 'jaguar', 'land rover', 'porsche', 'maserati'].includes(m)) return 'premium';
  if (['iveco', 'man', 'scania'].includes(m)) return 'commerciale';
  return 'media';
}

export function getSegmentoLabel(seg: string): string {
  const labels: Record<string, string> = {
    utilitaria: 'Utilitaria',
    media: 'Berlina media',
    premium: 'Premium / Sport',
    commerciale: 'Commerciale',
    suv: 'SUV',
  };
  return labels[seg] || seg;
}

// Modelli SUV noti
const SUV_MODELS = ['qashqai', 'tucson', 'sportage', 'tiguan', 'rav4', 'x1', 'x3', 'x5', 'q3', 'q5', 'glc', 'gla', 'stelvio', 'renegade', 'compass', 'duster', 'captur', '2008', '3008', '5008', 'kuga', 'ecosport', 't-cross', 't-roc', 'karoq', 'kodiaq', 'ateca', 'tarraco', 'cx-5', 'cx-30', 'hr-v', 'cr-v'];

export function getSegmentoVeicolo(veicolo: Veicolo): string {
  const modLow = veicolo.modello.toLowerCase();
  if (SUV_MODELS.some(s => modLow.includes(s))) return 'suv';
  // Ducato, Transporter, Vito → commerciale
  if (['ducato', 'transporter', 'vito', 'sprinter', 'crafter', 'daily', 'boxer', 'jumper', 'master', 'trafic', 'vivaro'].some(s => modLow.includes(s))) return 'commerciale';
  return getSegmento(veicolo.marca);
}

// Il tariffario completo
export function buildTariffario(prezzoOra: number): VoceTariffario[] {
  return [
    // ---- Tagliando & Manutenzione ----
    {
      id: 'tagliando_base', categoria: 'Tagliando & Manutenzione',
      nome: 'Tagliando base (olio + filtri)',
      descrizione: 'Sostituzione olio motore, filtro olio, filtro aria, filtro abitacolo. Controllo livelli.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Olio motore 5W-30 (4L)', prezzoMin: 28, prezzoMax: 55 },
        { nome: 'Filtro olio', prezzoMin: 6, prezzoMax: 18 },
        { nome: 'Filtro aria motore', prezzoMin: 8, prezzoMax: 22 },
        { nome: 'Filtro abitacolo', prezzoMin: 8, prezzoMax: 20 },
      ],
    },
    {
      id: 'tagliando_completo', categoria: 'Tagliando & Manutenzione',
      nome: 'Tagliando completo',
      descrizione: 'Tagliando base + filtro carburante, candele, controllo freni, luci e livelli.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Olio motore 5W-30 (4L)', prezzoMin: 28, prezzoMax: 55 },
        { nome: 'Kit filtri completo (4 filtri)', prezzoMin: 30, prezzoMax: 65 },
        { nome: 'Candele (set 4)', prezzoMin: 15, prezzoMax: 45 },
      ],
    },
    {
      id: 'cambio_olio', categoria: 'Tagliando & Manutenzione',
      nome: 'Cambio olio e filtro olio',
      descrizione: 'Solo sostituzione olio motore e filtro olio.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [
        { nome: 'Olio motore (4L)', prezzoMin: 28, prezzoMax: 55 },
        { nome: 'Filtro olio', prezzoMin: 6, prezzoMax: 18 },
      ],
    },
    {
      id: 'sostituzione_candele', categoria: 'Tagliando & Manutenzione',
      nome: 'Sostituzione candele',
      descrizione: 'Sostituzione set candele di accensione.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [
        { nome: 'Candele (set 4)', prezzoMin: 15, prezzoMax: 45 },
      ],
    },
    {
      id: 'sostituzione_candelette', categoria: 'Tagliando & Manutenzione',
      nome: 'Sostituzione candelette (diesel)',
      descrizione: 'Sostituzione candelette preriscaldamento motore diesel.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Candelette (set 4)', prezzoMin: 30, prezzoMax: 80 },
      ],
    },
    {
      id: 'liquido_raffreddamento', categoria: 'Tagliando & Manutenzione',
      nome: 'Sostituzione liquido raffreddamento',
      descrizione: 'Svuotamento e riempimento circuito raffreddamento.',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [
        { nome: 'Liquido raffreddamento (5L)', prezzoMin: 12, prezzoMax: 25 },
      ],
    },

    // ---- Freni ----
    {
      id: 'pastiglie_ant', categoria: 'Freni',
      nome: 'Sostituzione pastiglie anteriori',
      descrizione: 'Sostituzione pastiglie freno asse anteriore con controllo dischi.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Pastiglie freno anteriori (set)', prezzoMin: 20, prezzoMax: 55 },
      ],
    },
    {
      id: 'pastiglie_post', categoria: 'Freni',
      nome: 'Sostituzione pastiglie posteriori',
      descrizione: 'Sostituzione pastiglie freno asse posteriore.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Pastiglie freno posteriori (set)', prezzoMin: 18, prezzoMax: 50 },
      ],
    },
    {
      id: 'dischi_pastiglie_ant', categoria: 'Freni',
      nome: 'Dischi + pastiglie anteriori',
      descrizione: 'Sostituzione completa dischi e pastiglie asse anteriore.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Dischi freno anteriori (coppia)', prezzoMin: 40, prezzoMax: 120 },
        { nome: 'Pastiglie freno anteriori (set)', prezzoMin: 20, prezzoMax: 55 },
      ],
    },
    {
      id: 'dischi_pastiglie_post', categoria: 'Freni',
      nome: 'Dischi + pastiglie posteriori',
      descrizione: 'Sostituzione completa dischi e pastiglie asse posteriore.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Dischi freno posteriori (coppia)', prezzoMin: 35, prezzoMax: 100 },
        { nome: 'Pastiglie freno posteriori (set)', prezzoMin: 18, prezzoMax: 50 },
      ],
    },
    {
      id: 'liquido_freni', categoria: 'Freni',
      nome: 'Sostituzione liquido freni',
      descrizione: 'Spurgo e sostituzione liquido impianto frenante DOT4.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [
        { nome: 'Liquido freni DOT4 (1L)', prezzoMin: 6, prezzoMax: 15 },
      ],
    },

    // ---- Distribuzione ----
    {
      id: 'cinghia_distribuzione', categoria: 'Distribuzione',
      nome: 'Sostituzione cinghia distribuzione',
      descrizione: 'Sostituzione cinghia distribuzione, tenditore e rullo. Intervallo consigliato ogni 100-120.000 km.',
      manodopera: { ore: 4, prezzoOra },
      ricambi: [
        { nome: 'Kit distribuzione (cinghia + tenditore + rullo)', prezzoMin: 80, prezzoMax: 220 },
      ],
    },
    {
      id: 'distribuzione_pompa', categoria: 'Distribuzione',
      nome: 'Distribuzione + pompa acqua',
      descrizione: 'Kit distribuzione completo con pompa acqua.',
      manodopera: { ore: 5, prezzoOra },
      ricambi: [
        { nome: 'Kit distribuzione completo + pompa acqua', prezzoMin: 120, prezzoMax: 320 },
      ],
    },
    {
      id: 'cinghia_servizi', categoria: 'Distribuzione',
      nome: 'Sostituzione cinghia servizi',
      descrizione: 'Sostituzione cinghia servizi (alternatore, AC, servosterzo).',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [
        { nome: 'Cinghia servizi', prezzoMin: 12, prezzoMax: 35 },
      ],
    },

    // ---- Motore ----
    {
      id: 'pompa_acqua', categoria: 'Motore',
      nome: 'Sostituzione pompa acqua',
      descrizione: 'Sostituzione pompa acqua (senza kit distribuzione).',
      manodopera: { ore: 2, prezzoOra },
      ricambi: [
        { nome: 'Pompa acqua', prezzoMin: 30, prezzoMax: 90 },
      ],
    },
    {
      id: 'termostato', categoria: 'Motore',
      nome: 'Sostituzione termostato',
      descrizione: 'Sostituzione termostato circuito raffreddamento.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Termostato', prezzoMin: 15, prezzoMax: 45 },
      ],
    },
    {
      id: 'guarnizione_testata', categoria: 'Motore',
      nome: 'Sostituzione guarnizione testata',
      descrizione: 'Rimozione testata, sostituzione guarnizione, rimontaggio e messa in fase.',
      manodopera: { ore: 8, prezzoOra },
      ricambi: [
        { nome: 'Guarnizione testata', prezzoMin: 30, prezzoMax: 80 },
        { nome: 'Kit bulloneria testata', prezzoMin: 20, prezzoMax: 50 },
      ],
    },
    {
      id: 'turbo', categoria: 'Motore',
      nome: 'Sostituzione turbina',
      descrizione: 'Smontaggio e sostituzione turbocompressore.',
      manodopera: { ore: 4, prezzoOra },
      ricambi: [
        { nome: 'Turbocompressore (rigenerato)', prezzoMin: 350, prezzoMax: 900 },
      ],
    },
    {
      id: 'iniettori', categoria: 'Motore',
      nome: 'Sostituzione iniettori',
      descrizione: 'Sostituzione set iniettori carburante.',
      manodopera: { ore: 2, prezzoOra },
      ricambi: [
        { nome: 'Iniettori (set 4)', prezzoMin: 120, prezzoMax: 400 },
      ],
    },

    // ---- Sospensioni & Sterzo ----
    {
      id: 'ammortizzatori_ant', categoria: 'Sospensioni & Sterzo',
      nome: 'Ammortizzatori anteriori (coppia)',
      descrizione: 'Sostituzione coppia ammortizzatori anteriori.',
      manodopera: { ore: 2, prezzoOra },
      ricambi: [
        { nome: 'Ammortizzatori anteriori (coppia)', prezzoMin: 60, prezzoMax: 180 },
      ],
    },
    {
      id: 'ammortizzatori_post', categoria: 'Sospensioni & Sterzo',
      nome: 'Ammortizzatori posteriori (coppia)',
      descrizione: 'Sostituzione coppia ammortizzatori posteriori.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Ammortizzatori posteriori (coppia)', prezzoMin: 50, prezzoMax: 150 },
      ],
    },
    {
      id: 'braccetti', categoria: 'Sospensioni & Sterzo',
      nome: 'Sostituzione braccetti oscillanti',
      descrizione: 'Sostituzione bracci oscillanti anteriori con silent block.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Braccio oscillante (coppia)', prezzoMin: 40, prezzoMax: 120 },
      ],
    },
    {
      id: 'testine_sterzo', categoria: 'Sospensioni & Sterzo',
      nome: 'Sostituzione testine sterzo',
      descrizione: 'Sostituzione testine biellette dello sterzo + convergenza.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Testine sterzo (coppia)', prezzoMin: 20, prezzoMax: 60 },
      ],
    },
    {
      id: 'cuscinetti_ruota', categoria: 'Sospensioni & Sterzo',
      nome: 'Sostituzione cuscinetto ruota',
      descrizione: 'Sostituzione cuscinetto mozzo ruota (1 ruota).',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Cuscinetto ruota', prezzoMin: 25, prezzoMax: 70 },
      ],
    },

    // ---- Scarico & Emissioni ----
    {
      id: 'marmitta', categoria: 'Scarico & Emissioni',
      nome: 'Sostituzione marmitta/silenziatore',
      descrizione: 'Sostituzione silenziatore posteriore.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [
        { nome: 'Silenziatore posteriore', prezzoMin: 50, prezzoMax: 150 },
      ],
    },
    {
      id: 'catalizzatore', categoria: 'Scarico & Emissioni',
      nome: 'Sostituzione catalizzatore',
      descrizione: 'Sostituzione convertitore catalitico.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Catalizzatore', prezzoMin: 150, prezzoMax: 500 },
      ],
    },
    {
      id: 'fap_dpf', categoria: 'Scarico & Emissioni',
      nome: 'Pulizia/rigenerazione FAP/DPF',
      descrizione: 'Rigenerazione forzata filtro antiparticolato o pulizia chimica.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Additivo rigenerazione FAP', prezzoMin: 15, prezzoMax: 40 },
      ],
    },
    {
      id: 'sonda_lambda', categoria: 'Scarico & Emissioni',
      nome: 'Sostituzione sonda lambda',
      descrizione: 'Sostituzione sensore ossigeno scarico.',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [
        { nome: 'Sonda lambda', prezzoMin: 30, prezzoMax: 90 },
      ],
    },
    {
      id: 'valvola_egr', categoria: 'Scarico & Emissioni',
      nome: 'Pulizia/sostituzione valvola EGR',
      descrizione: 'Pulizia o sostituzione valvola ricircolo gas di scarico.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Valvola EGR', prezzoMin: 60, prezzoMax: 200 },
      ],
    },

    // ---- Climatizzazione ----
    {
      id: 'ricarica_clima', categoria: 'Climatizzazione',
      nome: 'Ricarica clima A/C',
      descrizione: 'Ricarica gas R134a/R1234yf, controllo perdite, verifica funzionamento.',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [
        { nome: 'Gas refrigerante + olio', prezzoMin: 20, prezzoMax: 60 },
      ],
    },
    {
      id: 'compressore_clima', categoria: 'Climatizzazione',
      nome: 'Sostituzione compressore A/C',
      descrizione: 'Sostituzione compressore climatizzatore.',
      manodopera: { ore: 2.5, prezzoOra },
      ricambi: [
        { nome: 'Compressore A/C (rigenerato)', prezzoMin: 180, prezzoMax: 450 },
      ],
    },

    // ---- Elettrico & Batteria ----
    {
      id: 'batteria', categoria: 'Elettrico & Batteria',
      nome: 'Sostituzione batteria',
      descrizione: 'Sostituzione batteria avviamento con reset centralina.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [
        { nome: 'Batteria 12V (60-70Ah)', prezzoMin: 60, prezzoMax: 130 },
      ],
    },
    {
      id: 'alternatore', categoria: 'Elettrico & Batteria',
      nome: 'Sostituzione alternatore',
      descrizione: 'Sostituzione alternatore.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Alternatore (rigenerato)', prezzoMin: 100, prezzoMax: 280 },
      ],
    },
    {
      id: 'motorino_avviamento', categoria: 'Elettrico & Batteria',
      nome: 'Sostituzione motorino avviamento',
      descrizione: 'Sostituzione motorino di avviamento.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [
        { nome: 'Motorino avviamento (rigenerato)', prezzoMin: 80, prezzoMax: 220 },
      ],
    },

    // ---- Trasmissione & Frizione ----
    {
      id: 'frizione', categoria: 'Trasmissione & Frizione',
      nome: 'Sostituzione kit frizione',
      descrizione: 'Sostituzione disco, spingidisco, cuscinetto reggispinta.',
      manodopera: { ore: 5, prezzoOra },
      ricambi: [
        { nome: 'Kit frizione completo (disco + spingidisco + cuscinetto)', prezzoMin: 100, prezzoMax: 300 },
      ],
    },
    {
      id: 'volano', categoria: 'Trasmissione & Frizione',
      nome: 'Sostituzione volano bimassa + frizione',
      descrizione: 'Sostituzione volano bimassa e kit frizione completo.',
      manodopera: { ore: 6, prezzoOra },
      ricambi: [
        { nome: 'Volano bimassa', prezzoMin: 200, prezzoMax: 500 },
        { nome: 'Kit frizione', prezzoMin: 100, prezzoMax: 300 },
      ],
    },
    {
      id: 'cambio_olio_cambio', categoria: 'Trasmissione & Frizione',
      nome: 'Cambio olio cambio/differenziale',
      descrizione: 'Sostituzione olio cambio manuale o automatico.',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [
        { nome: 'Olio cambio (2L)', prezzoMin: 15, prezzoMax: 50 },
      ],
    },
    {
      id: 'semiassi', categoria: 'Trasmissione & Frizione',
      nome: 'Sostituzione semiasse/giunto',
      descrizione: 'Sostituzione semiasse o cuffia giunto omocinetico.',
      manodopera: { ore: 2, prezzoOra },
      ricambi: [
        { nome: 'Semiasse / giunto omocinetico', prezzoMin: 50, prezzoMax: 180 },
      ],
    },

    // ---- Carrozzeria & Vetri ----
    {
      id: 'parabrezza', categoria: 'Carrozzeria & Vetri',
      nome: 'Sostituzione parabrezza',
      descrizione: 'Sostituzione parabrezza con calibrazione sensori (se presenti).',
      manodopera: { ore: 2, prezzoOra },
      ricambi: [
        { nome: 'Parabrezza (aftermarket)', prezzoMin: 120, prezzoMax: 350 },
      ],
    },
    {
      id: 'lucidatura', categoria: 'Carrozzeria & Vetri',
      nome: 'Lucidatura carrozzeria',
      descrizione: 'Lucidatura professionale intera carrozzeria.',
      manodopera: { ore: 4, prezzoOra },
      ricambi: [
        { nome: 'Prodotti lucidatura', prezzoMin: 15, prezzoMax: 40 },
      ],
    },

    // ---- Pneumatici ----
    {
      id: 'cambio_gomme', categoria: 'Pneumatici',
      nome: 'Cambio gomme stagionale (4 ruote)',
      descrizione: 'Smontaggio, montaggio, equilibratura 4 ruote.',
      manodopera: { ore: 1, prezzoOra },
      ricambi: [],
    },
    {
      id: 'convergenza', categoria: 'Pneumatici',
      nome: 'Convergenza / assetto ruote',
      descrizione: 'Regolazione geometria assale anteriore e posteriore.',
      manodopera: { ore: 0.75, prezzoOra },
      ricambi: [],
    },
    {
      id: 'equilibratura', categoria: 'Pneumatici',
      nome: 'Equilibratura 4 ruote',
      descrizione: 'Equilibratura statica e dinamica 4 ruote.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [],
    },

    // ---- Diagnosi ----
    {
      id: 'diagnosi_elettronica', categoria: 'Diagnosi',
      nome: 'Diagnosi elettronica completa',
      descrizione: 'Scansione centraline, lettura/cancellazione codici errore, report.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [],
    },
    {
      id: 'diagnosi_meccanica', categoria: 'Diagnosi',
      nome: 'Diagnosi meccanica approfondita',
      descrizione: 'Ispezione visiva, prova strada, test compressione, diagnosi guasto.',
      manodopera: { ore: 1.5, prezzoOra },
      ricambi: [],
    },
    {
      id: 'revisione', categoria: 'Diagnosi',
      nome: 'Revisione ministeriale',
      descrizione: 'Revisione periodica obbligatoria + eventuale pre-check.',
      manodopera: { ore: 0.5, prezzoOra },
      ricambi: [
        { nome: 'Tassa revisione', prezzoMin: 45, prezzoMax: 45 },
      ],
    },
  ];
}
