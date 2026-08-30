import { useState, useEffect, useMemo } from 'react';
import { Card, Badge, Button, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { generaDatiVeicolo, lookupTargaEsterna, DB_AUTO, type DatiVeicolo } from '@/lib/targaLookup';
import type { Veicolo, Cliente, Appuntamento } from '@/types/database';
import { PDFExport, buildPreventivoHtml, extractLogoColor } from './PDFExport';
import { ShareDocument } from '@/components/ShareDocument';

// ============================================================
// TARIFFARIO STANDARD OFFICINE ITALIANE
// Prezzi medi 2024-2026 per autovetture segmento B/C
// ============================================================

interface VoceManodopera {
  id: string;
  categoria: string;
  nome: string;
  descrizione: string;
  ore: number;           // ore lavoro stimate
  prezzoOraBase: number; // €/ora base
  /** Fattore moltiplicatore per segmento (utilitaria=0.8, media=1, premium=1.3, commerciale=1.1) */
}

interface VoceRicambio {
  id: string;
  categoria: string;
  nome: string;
  prezzoMin: number;
  prezzoMax: number;
  /** Fattore per segmento */
}

interface VoceTariffario {
  id: string;
  categoria: string;
  nome: string;
  descrizione: string;
  manodopera: { ore: number; prezzoOra: number };
  ricambi: { nome: string; prezzoMin: number; prezzoMax: number }[];
}

// Categorie del tariffario
const CATEGORIE_TARIFFARIO = [
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
const PREZZO_ORA: Record<string, number> = {
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

function getSegmentoLabel(seg: string): string {
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

function getSegmentoVeicolo(veicolo: Veicolo): string {
  const modLow = veicolo.modello.toLowerCase();
  if (SUV_MODELS.some(s => modLow.includes(s))) return 'suv';
  // Ducato, Transporter, Vito → commerciale
  if (['ducato', 'transporter', 'vito', 'sprinter', 'crafter', 'daily', 'boxer', 'jumper', 'master', 'trafic', 'vivaro'].some(s => modLow.includes(s))) return 'commerciale';
  return getSegmento(veicolo.marca);
}

// Il tariffario completo
function buildTariffario(prezzoOra: number): VoceTariffario[] {
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

// ============================================================
// COMPONENT
// ============================================================

interface RigaPreventivo {
  tipo: 'manodopera' | 'ricambio';
  desc: string;
  qta: number;
  prezzo: number;
}

function PreventivoBuilder({ onBack }: { onBack: () => void }) {
  const { officina } = useAuthStore();
  const [targa, setTarga] = useState('');
  const [searching, setSearching] = useState(false);
  const [veicolo, setVeicolo] = useState<Veicolo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [datiEsterni, setDatiEsterni] = useState<DatiVeicolo | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Preventivo builder
  const [righe, setRighe] = useState<RigaPreventivo[]>([]);
  const [categoriaAperta, setCategoriaAperta] = useState<string | null>(null);
  const [sconto, setSconto] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null);
  const [uploadingSavedPdf, setUploadingSavedPdf] = useState(false);

  // Manual vehicle selection — nome cliente + 4 dropdown sequenziali
  const [manualOpen, setManualOpen] = useState(false);
  const [selClienteNome, setSelClienteNome] = useState('');
  const [selMarca, setSelMarca] = useState('');
  const [selModello, setSelModello] = useState('');
  const [selCarburante, setSelCarburante] = useState('');
  const [selAnno, setSelAnno] = useState('');
  // Nome cliente inserito nella selezione manuale (usato per creare il cliente al salvataggio)
  const [manualClienteNome, setManualClienteNome] = useState('');

  const marcheOrdered = useMemo(() => DB_AUTO.map(b => b.marca).sort((a, b) => a.localeCompare(b)), []);
  const marcaObj = useMemo(() => DB_AUTO.find(b => b.marca === selMarca), [selMarca]);
  const modelloObj = useMemo(() => marcaObj?.modelli.find(m => m.nome === selModello), [marcaObj, selModello]);
  const carburantiDisponibili = useMemo(() => modelloObj?.carburanti || [], [modelloObj]);
  const anniDisponibili = useMemo(() => {
    if (!modelloObj) return [];
    const anni: number[] = [];
    for (let y = modelloObj.anni[1]; y >= modelloObj.anni[0]; y--) anni.push(y);
    return anni;
  }, [modelloObj]);

  const canConfirmManual = selClienteNome.trim() && selMarca && selModello && selCarburante && selAnno;

  const handleConfirmManual = () => {
    if (!modelloObj || !canConfirmManual) return;
    const anno = parseInt(selAnno);
    const potenzaKw = Math.round((modelloObj.kwRange[0] + modelloObj.kwRange[1]) / 2);
    const potenzaCv = Math.round(potenzaKw * 1.36);
    let euroClasse = 'Euro 6';
    if (anno < 2015) euroClasse = 'Euro 5';
    if (anno < 2011) euroClasse = 'Euro 4';
    if (anno < 2006) euroClasse = 'Euro 3';
    const classe = modelloObj.classe;
    const posti = classe === 'Commerciale' ? 3 : classe === 'Monovolume' ? 7 : 5;
    const pesoBase = classe === 'Utilitaria' ? 1000 : classe === 'Berlina' ? 1250 :
      classe === 'SUV' ? 1450 : classe === 'Commerciale' ? 1800 : 1300;
    const peso = pesoBase + 100;
    const cilindrata = modelloObj.cilindrate[0] === '0' ? '' : modelloObj.cilindrate[0] + ' cc';

    setVeicolo(null);
    // Non azzerare `cliente`: se e' stato trovato cercando per nome (cliente
    // esistente senza veicolo), perderlo creerebbe un doppione in anagrafica
    // e farebbe sparire telefono/email usati per WhatsApp ed email.
    if (cliente && cliente.nome !== selClienteNome.trim()) setCliente(null);
    setTarga('');
    setNotFound(false);
    setRighe([]);
    setManualClienteNome(selClienteNome.trim());
    setDatiEsterni({
      targa: 'MANUALE',
      marca: selMarca,
      modello: selModello,
      anno,
      carburante: selCarburante,
      cilindrata: cilindrata || undefined,
      potenzaKw,
      potenzaCv,
      classe,
      euroClasse,
      posti,
      peso,
      neopatentati: potenzaKw <= 70 && (potenzaKw / (peso / 1000)) <= 55,
      daDatabase: false,
    });
    setSaved(false);
    setSavedPdfUrl(null);
    setManualOpen(false);
  };

  const clearManualSelection = () => {
    setSelClienteNome('');
    setSelMarca('');
    setSelModello('');
    setSelCarburante('');
    setSelAnno('');
    // Va azzerato anche qui, altrimenti il preventivo successivo eredita
    // il nome cliente della selezione manuale precedente.
    setManualClienteNome('');
  };

  const segmento = veicolo
    ? getSegmentoVeicolo(veicolo)
    : datiEsterni
      ? (datiEsterni.classe === 'Utilitaria' ? 'utilitaria' : datiEsterni.classe === 'SUV' ? 'suv' : datiEsterni.classe === 'Commerciale' ? 'commerciale' : datiEsterni.classe === 'Berlina' ? 'media' : 'media')
      : 'media';
  const prezzoOra = PREZZO_ORA[segmento] || 45;
  const hasVeicolo = veicolo || datiEsterni;
  const tariffario = useMemo(() => buildTariffario(prezzoOra), [prezzoOra]);

  // Raggruppa per categoria
  const perCategoria = useMemo(() => {
    const map: Record<string, VoceTariffario[]> = {};
    tariffario.forEach(v => {
      if (!map[v.categoria]) map[v.categoria] = [];
      map[v.categoria].push(v);
    });
    return map;
  }, [tariffario]);

  const handleSearch = async () => {
    const raw = targa.trim();
    const t = raw.toUpperCase().replace(/\s/g, '');
    if (raw.length < 2) return;
    setSearching(true);
    setNotFound(false);
    setVeicolo(null);
    setCliente(null);
    setDatiEsterni(null);
    setRighe([]);
    setSaved(false);
    setSavedPdfUrl(null);
    clearManualSelection();
    setManualOpen(false);

    // Una targa non contiene spazi e mescola lettere e cifre: senza questo
    // controllo un nome come "Mario Rossi" diventava "MARIOROSSI", superava
    // il test di targa e faceva inventare un veicolo inesistente.
    const sembraTarga = !/\s/.test(raw) && /^[A-Z0-9]{5,8}$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t);

    // Cerca il veicolo per targa restando dentro l'officina corrente.
    const cercaPerTarga = async (esatta: boolean) => {
      if (!officina?.id) return null;
      let q = supabase
        .from('veicoli')
        .select('*, clienti!inner(officina_id)')
        .eq('clienti.officina_id', officina.id);
      q = esatta ? q.eq('targa', t) : q.ilike('targa', `%${t}%`);
      const { data } = await q.limit(1);
      return data && data.length > 0 ? data[0] : null;
    };

    const usaVeicolo = async (v: { cliente_id: string }) => {
      setVeicolo(v as Veicolo);
      const { data: cl } = await supabase.from('clienti').select('*').eq('id', v.cliente_id).single();
      if (cl) setCliente(cl);
      setSearching(false);
    };

    // 1. Se sembra una targa, cercala per prima (corrispondenza esatta).
    if (sembraTarga) {
      const v = await cercaPerTarga(true);
      if (v) { await usaVeicolo(v); return; }
    }

    // 2. Cerca per nome cliente.
    if (officina?.id) {
      const { data: clientiByNome } = await supabase
        .from('clienti')
        .select('*')
        .eq('officina_id', officina.id)
        .ilike('nome', `%${raw}%`)
        .order('nome')
        .limit(1);

      if (clientiByNome && clientiByNome.length > 0) {
        const cl = clientiByNome[0];
        const { data: veicoliDelCliente } = await supabase
          .from('veicoli')
          .select('*')
          .eq('cliente_id', cl.id)
          .limit(1);
        if (veicoliDelCliente && veicoliDelCliente.length > 0) {
          setCliente(cl);
          setVeicolo(veicoliDelCliente[0]);
          setSearching(false);
          return;
        }
        // Cliente trovato ma senza veicolo: propone la selezione manuale con nome gia noto
        setCliente(cl);
        setSelClienteNome(cl.nome);
        setManualOpen(true);
        setSearching(false);
        return;
      }
    }

    // 3. Targa parziale (es. solo alcune lettere digitate).
    const vParziale = await cercaPerTarga(false);
    if (vParziale) { await usaVeicolo(vParziale); return; }

    // 4. Solo per una targa plausibile ha senso il lookup esterno.
    if (sembraTarga) {
      const datiReali = await lookupTargaEsterna(t);
      setDatiEsterni(datiReali && datiReali.marca ? datiReali : generaDatiVeicolo(t));
    } else {
      // Nome non trovato: apre la selezione manuale gia' compilata col nome,
      // invece di inventare un veicolo.
      setSelClienteNome(raw);
      setManualOpen(true);
    }
    setSearching(false);
  };

  const addVoce = (voce: VoceTariffario) => {
    const nuoveRighe: RigaPreventivo[] = [];
    // Manodopera
    const costoMano = Math.round(voce.manodopera.ore * voce.manodopera.prezzoOra * 100) / 100;
    nuoveRighe.push({
      tipo: 'manodopera',
      desc: voce.nome,
      qta: 1,
      prezzo: costoMano,
    });
    // Ricambi (prezzo medio tra min e max)
    voce.ricambi.forEach(r => {
      const prezzoMedio = Math.round(((r.prezzoMin + r.prezzoMax) / 2) * 100) / 100;
      nuoveRighe.push({
        tipo: 'ricambio',
        desc: r.nome,
        qta: 1,
        prezzo: prezzoMedio,
      });
    });
    setRighe(prev => [...prev, ...nuoveRighe]);
  };

  const removeRiga = (idx: number) => {
    if (!confirm('Eliminare questa riga?')) return;
    setRighe(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRigaPrezzo = (idx: number, prezzo: number) => {
    setRighe(prev => prev.map((r, i) => i === idx ? { ...r, prezzo } : r));
  };

  const updateRigaQta = (idx: number, qta: number) => {
    setRighe(prev => prev.map((r, i) => i === idx ? { ...r, qta } : r));
  };

  const subtotale = righe.reduce((sum, r) => sum + r.qta * r.prezzo, 0);
  const scontoEuro = subtotale * sconto / 100;
  const imponibile = subtotale - scontoEuro;
  const iva = imponibile * 0.22;
  const totale = imponibile + iva;

  const totaleManodopera = righe.filter(r => r.tipo === 'manodopera').reduce((s, r) => s + r.qta * r.prezzo, 0);
  const totaleRicambi = righe.filter(r => r.tipo === 'ricambio').reduce((s, r) => s + r.qta * r.prezzo, 0);

  // Helper: dati veicolo unificati (DB locale o lookup esterno)
  const vMarca = veicolo?.marca || datiEsterni?.marca || '';
  const vModello = veicolo?.modello || datiEsterni?.modello || '';
  const vTarga = veicolo?.targa || datiEsterni?.targa || '';
  const vAnno = veicolo?.anno || datiEsterni?.anno || 0;
  const vKm = veicolo?.km || 0;
  const vCarburante = veicolo?.carburante || datiEsterni?.carburante || '';

  const handleSave = async () => {
    if ((!veicolo && !datiEsterni) || righe.length === 0) return;
    setSaving(true);
    setSaveError('');

    let veicoloId = veicolo?.id;
    let clienteId = cliente?.id;

    // Se il veicolo viene da lookup esterno, crea prima cliente + veicolo nel DB
    if (!veicoloId && datiEsterni && officina) {
      // Crea cliente generico
      if (!clienteId) {
        const { data: newCliente, error: cliErr } = await supabase
          .from('clienti')
          .insert({
            officina_id: officina.id,
            nome: datiEsterni.targa === 'MANUALE'
              ? (manualClienteNome.trim() || `Cliente ${datiEsterni.marca} ${datiEsterni.modello}`)
              : `Cliente ${datiEsterni.targa}`,
            email: '',
            tel: '',
            note: datiEsterni.targa === 'MANUALE' ? `Aggiunto da preventivo selezione manuale - ${datiEsterni.marca} ${datiEsterni.modello}` : `Aggiunto da preventivo targa ${datiEsterni.targa}`,
          })
          .select()
          .single();
        if (cliErr || !newCliente) {
          setSaving(false);
          setSaveError('Cliente non creato: ' + (cliErr?.message || 'errore sconosciuto'));
          return;
        }
        clienteId = newCliente.id;
      }
      // Crea veicolo
      if (clienteId) {
        const { data: newVeicolo, error: veiErr } = await supabase
          .from('veicoli')
          .insert({
            cliente_id: clienteId,
            marca: datiEsterni.marca,
            modello: datiEsterni.modello,
            targa: datiEsterni.targa === 'MANUALE' ? '' : datiEsterni.targa,
            anno: datiEsterni.anno,
            km: 0,
            carburante: datiEsterni.carburante,
          })
          .select()
          .single();
        if (veiErr || !newVeicolo) {
          setSaving(false);
          setSaveError('Veicolo non creato: ' + (veiErr?.message || 'errore sconosciuto'));
          return;
        }
        veicoloId = newVeicolo.id;
      }
    }

    if (!veicoloId || !clienteId || !officina) {
      setSaving(false);
      setSaveError('Dati incompleti: seleziona un veicolo prima di salvare.');
      return;
    }

    // Cerca se esiste un appuntamento aperto per questo veicolo
    const { data: apps } = await supabase
      .from('appuntamenti')
      .select('id')
      .eq('veicolo_id', veicoloId)
      .in('stato', ['richiesta', 'prenotato', 'in_diagnosi', 'in_lavorazione', 'attesa_ricambi'])
      .order('created_at', { ascending: false })
      .limit(1);

    let appuntamentoId = apps?.[0]?.id;

    // Se non c'è appuntamento aperto, creane uno
    if (!appuntamentoId) {
      const { data: newApp, error: appErr } = await supabase
        .from('appuntamenti')
        .insert({
          officina_id: officina.id,
          cliente_id: clienteId,
          veicolo_id: veicoloId,
          data_ora: new Date().toISOString(),
          stato: 'prenotato',
          priorita: 'normale',
          problema: 'Preventivo da tariffario',
        })
        .select()
        .single();
      if (appErr || !newApp) {
        setSaving(false);
        setSaveError('Appuntamento non creato: ' + (appErr?.message || 'errore sconosciuto'));
        return;
      }
      appuntamentoId = newApp.id;
    }

    if (appuntamentoId) {
      const { data: newPreventivo, error: prevErr } = await supabase
        .from('preventivi')
        .insert({
          appuntamento_id: appuntamentoId,
          righe,
          subtotale,
          sconto: scontoEuro,
          iva,
          totale,
          stato: 'bozza',
        })
        .select()
        .single();
      // Solo un inserimento andato a buon fine puo' sbloccare l'invio:
      // prima bastava arrivare qui per mostrare "Salvato!" anche in errore.
      if (prevErr || !newPreventivo) {
        setSaving(false);
        setSaveError('Preventivo non salvato: ' + (prevErr?.message || 'errore sconosciuto'));
        return;
      }
      setSaved(true);

      // Genera l'HTML del preventivo e lo carica su Storage per ottenere un
      // link condivisibile da usare in WhatsApp/Email (invece del solo testo)
      if (newPreventivo && officina) {
        setUploadingSavedPdf(true);
        try {
          const veicoloPerPdf: Veicolo | undefined = veicolo || (datiEsterni ? {
            id: veicoloId || '',
            cliente_id: clienteId || '',
            marca: datiEsterni.marca,
            modello: datiEsterni.modello,
            targa: datiEsterni.targa === 'MANUALE' ? '' : datiEsterni.targa,
            anno: datiEsterni.anno,
            km: 0,
            carburante: datiEsterni.carburante,
          } : undefined);
          const clientePerPdf: Cliente | undefined = cliente || (manualClienteNome.trim() ? {
            id: clienteId || '',
            officina_id: officina.id,
            nome: manualClienteNome.trim(),
            email: '',
            tel: '',
          } : undefined);
          const appuntamentoPerPdf: Appuntamento = {
            id: appuntamentoId,
            officina_id: officina.id,
            cliente_id: clienteId || '',
            veicolo_id: veicoloId || '',
            data_ora: new Date().toISOString(),
            stato: 'prenotato',
            priorita: 'normale',
            problema: 'Preventivo da tariffario',
            clienti: clientePerPdf,
            veicoli: veicoloPerPdf,
          };
          const accent = await extractLogoColor(officina.logo_url);
          const html = buildPreventivoHtml(
            appuntamentoPerPdf,
            {
              id: newPreventivo.id,
              appuntamento_id: appuntamentoId,
              righe,
              subtotale,
              sconto: scontoEuro,
              iva,
              totale,
              stato: 'bozza',
              created_at: newPreventivo.created_at,
            },
            officina,
            accent
          );
          const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
          const path = `${officina.id}/preventivo-${newPreventivo.id}.html`;
          const { error: upErr } = await supabase.storage
            .from('preventivi')
            .upload(path, blob, { upsert: true, contentType: 'text/html; charset=utf-8' });
          if (!upErr) {
            const { data: pub } = supabase.storage.from('preventivi').getPublicUrl(path);
            setSavedPdfUrl(pub.publicUrl);
          }
        } finally {
          setUploadingSavedPdf(false);
        }
      }
    }

    setSaving(false);
  };

  const handleStampa = async () => {
    const accent = await extractLogoColor(officina?.logo_url);
    const logoBlock = officina?.logo_url
      ? `<img src="${officina.logo_url}" alt="Logo" style="width:44px;height:44px;border-radius:10px;object-fit:cover;margin-right:12px;" />`
      : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preventivo</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 30px; }
      .header { display:flex; justify-content:space-between; border-bottom:3px solid ${accent}; padding-bottom:20px; margin-bottom:20px; }
      .header .brand { display:flex; align-items:center; }
      .header h1 { color:${accent}; font-size:24px; }
      .header .info { text-align:right; font-size:12px; color:#555; }
      .section { margin-bottom: 16px; }
      .section h3 { font-size:13px; color:${accent}; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; }
      .veicolo-box { background:#f0f4ff; border:1px solid #c7d2fe; border-radius:8px; padding:12px; font-size:13px; }
      table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
      th { background:#f3f4f6; text-align:left; padding:8px 6px; font-weight:600; border-bottom:2px solid #d1d5db; }
      td { padding:6px; border-bottom:1px solid #e5e7eb; }
      .tipo-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; }
      .tipo-mano { background:#dbeafe; color:#1e40af; }
      .tipo-ric { background:#fef3c7; color:#92400e; }
      .text-right { text-align:right; }
      .totals { margin-top:16px; }
      .totals table { width:250px; margin-left:auto; }
      .totals td { border:none; padding:4px 6px; font-size:13px; }
      .total-row td { font-weight:bold; font-size:16px; color:${accent}; border-top:2px solid ${accent}; padding-top:8px; }
      .footer { margin-top:30px; font-size:10px; color:#999; text-align:center; border-top:1px solid #e5e7eb; padding-top:10px; }
      ${note ? '.note { margin-top:16px; padding:10px; background:#fefce8; border:1px solid #fde68a; border-radius:6px; font-size:12px; }' : ''}
    </style></head><body>
      <div class="header">
        <div class="brand">
          ${logoBlock}
          <div>
            <h1>${officina?.nome || 'Officina'}</h1>
            <div style="font-size:12px;color:#555;margin-top:4px;">${officina?.indirizzo || ''}</div>
            <div style="font-size:12px;color:#555;">${officina?.tel || ''} · ${officina?.email || ''}</div>
            ${officina?.p_iva ? `<div style="font-size:11px;color:#888;margin-top:2px;">P.IVA: ${officina.p_iva}</div>` : ''}
          </div>
        </div>
        <div class="info">
          <div style="font-size:18px;font-weight:bold;color:${accent};">PREVENTIVO</div>
          <div>Data: ${new Date().toLocaleDateString('it-IT')}</div>
          ${cliente ? `<div>Cliente: ${cliente.nome}</div>` : ''}
          ${cliente?.tel ? `<div>Tel: ${cliente.tel}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <h3>Veicolo</h3>
        <div class="veicolo-box">
          <strong>${vMarca} ${vModello}</strong>${vTarga && vTarga !== 'MANUALE' ? ` — Targa: <strong>${vTarga}</strong>` : ''}<br>
          Anno: ${vAnno} · Km: ${vKm > 0 ? vKm.toLocaleString() : 'N/D'} · Carburante: ${vCarburante}${datiEsterni ? `${datiEsterni.cilindrata ? ` · Cilindrata: ${datiEsterni.cilindrata}` : ''} · Potenza: ${datiEsterni.potenzaKw} kW (${datiEsterni.potenzaCv} CV) · ${datiEsterni.euroClasse}` : ''}
          · Segmento: ${getSegmentoLabel(segmento)} (${fmtEuro(prezzoOra)}/ora)
        </div>
      </div>

      <div class="section">
        <h3>Dettaglio lavorazioni</h3>
        <table>
          <thead>
            <tr><th>Tipo</th><th>Descrizione</th><th class="text-right">Qta</th><th class="text-right">Prezzo</th><th class="text-right">Totale</th></tr>
          </thead>
          <tbody>
            ${righe.map(r => `
              <tr>
                <td><span class="tipo-badge ${r.tipo === 'manodopera' ? 'tipo-mano' : 'tipo-ric'}">${r.tipo === 'manodopera' ? 'Manodopera' : 'Ricambio'}</span></td>
                <td>${r.desc}</td>
                <td class="text-right">${r.qta}</td>
                <td class="text-right">${fmtEuro(r.prezzo)}</td>
                <td class="text-right"><strong>${fmtEuro(r.qta * r.prezzo)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="totals">
        <table>
          <tr><td>Manodopera:</td><td class="text-right">${fmtEuro(totaleManodopera)}</td></tr>
          <tr><td>Ricambi:</td><td class="text-right">${fmtEuro(totaleRicambi)}</td></tr>
          <tr><td>Subtotale:</td><td class="text-right">${fmtEuro(subtotale)}</td></tr>
          ${sconto > 0 ? `<tr><td>Sconto (${sconto}%):</td><td class="text-right">-${fmtEuro(scontoEuro)}</td></tr>` : ''}
          <tr><td>IVA (22%):</td><td class="text-right">${fmtEuro(iva)}</td></tr>
          <tr class="total-row"><td>TOTALE:</td><td class="text-right">${fmtEuro(totale)}</td></tr>
        </table>
      </div>

      ${note ? `<div class="note"><strong>Note:</strong> ${note}</div>` : ''}

      <div class="footer">
        Preventivo valido 30 giorni dalla data di emissione. I prezzi dei ricambi possono variare in base alla disponibilita.<br>
        Generato con OfficinAI · ${officina?.nome || ''}
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header with back */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nuovo Preventivo</h2>
          <p className="text-xs text-gray-500">Cerca per targa o nome cliente, oppure seleziona manualmente il veicolo</p>
        </div>
      </div>

      {/* Search by targa */}
      <Card className="!p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">Cerca per targa o nome cliente</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={targa}
              onChange={(e) => setTarga(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Es. FH123AB oppure Mario Rossi"
              className="w-full px-4 py-2.5 pr-8 rounded-xl border border-gray-300 bg-white text-sm font-semibold placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {targa && (
              <button
                onClick={() => {
                  setTarga('');
                  setVeicolo(null);
                  setCliente(null);
                  setDatiEsterni(null);
                  setNotFound(false);
                  setRighe([]);
                  setSaved(false);
                  setSavedPdfUrl(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Cancella ricerca"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || targa.trim().length < 2}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {searching ? '...' : 'Cerca'}
          </button>
        </div>
        {notFound && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            Nessun risultato per "{targa}". Controlla targa o nome, oppure usa la selezione manuale qui sotto.
          </div>
        )}
      </Card>

      {/* Selezione manuale veicolo — 4 dropdown sequenziali */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
        <button
          onClick={() => setManualOpen(!manualOpen)}
          className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-600">
            {datiEsterni?.targa === 'MANUALE'
              ? `${datiEsterni.marca} ${datiEsterni.modello} — ${datiEsterni.carburante} ${datiEsterni.anno}`
              : 'Selezione manuale veicolo'}
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${manualOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {manualOpen && (
          <div className="px-4 pb-4 border-t border-gray-100 space-y-3 mt-3">
            {/* Nome cliente */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Nome cliente *</label>
              <input
                type="text"
                value={selClienteNome}
                onChange={(e) => setSelClienteNome(e.target.value)}
                placeholder="Nome e cognome del cliente"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Riga 1: Marca + Modello */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Marca</label>
                <select
                  value={selMarca}
                  onChange={(e) => { setSelMarca(e.target.value); setSelModello(''); setSelCarburante(''); setSelAnno(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- Marca --</option>
                  {marcheOrdered.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Modello</label>
                <select
                  value={selModello}
                  onChange={(e) => { setSelModello(e.target.value); setSelCarburante(''); setSelAnno(''); }}
                  disabled={!selMarca}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                >
                  <option value="">-- Modello --</option>
                  {marcaObj?.modelli.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Riga 2: Alimentazione + Anno */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Alimentazione</label>
                <select
                  value={selCarburante}
                  onChange={(e) => setSelCarburante(e.target.value)}
                  disabled={!selModello}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                >
                  <option value="">-- Alimentazione --</option>
                  {carburantiDisponibili.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Anno</label>
                <select
                  value={selAnno}
                  onChange={(e) => setSelAnno(e.target.value)}
                  disabled={!selCarburante}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                >
                  <option value="">-- Anno --</option>
                  {anniDisponibili.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Riepilogo + Conferma */}
            {canConfirmManual && modelloObj && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-gray-700">
                  <span className="font-bold text-gray-900">{selMarca} {selModello}</span>
                  <span className="text-gray-400 mx-1">·</span>{selCarburante}
                  <span className="text-gray-400 mx-1">·</span>{selAnno}
                  <span className="text-gray-400 mx-1">·</span>{modelloObj.kwRange[0]}-{modelloObj.kwRange[1]} kW
                  <span className="text-gray-400 mx-1">·</span>{modelloObj.classe}
                </div>
              </div>
            )}

            {/* Bottoni */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmManual}
                disabled={!canConfirmManual}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Conferma veicolo
              </button>
              {selMarca && (
                <button
                  onClick={() => {
                    clearManualSelection();
                    setDatiEsterni(null);
                    setRighe([]);
                    setSaved(false);
                    setSavedPdfUrl(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vehicle info */}
      {hasVeicolo && (
        <>
          {/* Vehicle card — from local DB */}
          {veicolo && (
            <Card className="!p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-blue-200 flex items-center justify-center text-3xl shrink-0">🚗</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 text-base">{veicolo.marca} {veicolo.modello}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Targa: <span className="font-mono font-bold">{veicolo.targa}</span> · Anno: {veicolo.anno} · {veicolo.km?.toLocaleString()} km · {veicolo.carburante}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge color="#1e40af" bg="#dbeafe">
                      {getSegmentoLabel(segmento)}
                    </Badge>
                    <span className="text-[10px] text-gray-500">Tariffa: {fmtEuro(prezzoOra)}/ora</span>
                  </div>
                  {cliente && (
                    <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-gray-600">
                      <span className="font-semibold">Proprietario:</span> {cliente.nome}
                      {cliente.tel && <span> · {cliente.tel}</span>}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Cliente registrato</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Vehicle card — from external lookup / targa database */}
          {!veicolo && datiEsterni && (
            <Card className={`!p-4 ${datiEsterni.targa === 'MANUALE' ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 ${datiEsterni.targa === 'MANUALE' ? 'bg-emerald-200' : 'bg-indigo-200'}`}>{datiEsterni.targa === 'MANUALE' ? '🚗' : '🔍'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 text-base">{datiEsterni.marca} {datiEsterni.modello}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {datiEsterni.targa && datiEsterni.targa !== 'MANUALE' && (<>Targa: <span className="font-mono font-bold">{datiEsterni.targa}</span> · </>)}Anno: {datiEsterni.anno} · {datiEsterni.carburante}
                  </div>

                  {/* Dati tecnici dettagliati */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px]">
                    {datiEsterni.cilindrata && (
                      <div><span className="text-gray-400">Cilindrata:</span> <span className="font-medium text-gray-700">{datiEsterni.cilindrata}</span></div>
                    )}
                    {datiEsterni.potenzaKw && (
                      <div><span className="text-gray-400">Potenza:</span> <span className="font-medium text-gray-700">{datiEsterni.potenzaKw} kW ({datiEsterni.potenzaCv} CV)</span></div>
                    )}
                    {datiEsterni.classe && (
                      <div><span className="text-gray-400">Classe:</span> <span className="font-medium text-gray-700">{datiEsterni.classe}</span></div>
                    )}
                    {datiEsterni.euroClasse && (
                      <div><span className="text-gray-400">Norma:</span> <span className="font-medium text-gray-700">{datiEsterni.euroClasse}</span></div>
                    )}
                    {datiEsterni.colore && (
                      <div><span className="text-gray-400">Colore:</span> <span className="font-medium text-gray-700">{datiEsterni.colore}</span></div>
                    )}
                    {datiEsterni.posti && (
                      <div><span className="text-gray-400">Posti:</span> <span className="font-medium text-gray-700">{datiEsterni.posti}</span></div>
                    )}
                    {datiEsterni.peso && (
                      <div><span className="text-gray-400">Massa:</span> <span className="font-medium text-gray-700">{datiEsterni.peso} kg</span></div>
                    )}
                    {datiEsterni.neopatentati !== undefined && (
                      <div><span className="text-gray-400">Neopatentati:</span> <span className={`font-medium ${datiEsterni.neopatentati ? 'text-emerald-600' : 'text-red-600'}`}>{datiEsterni.neopatentati ? 'Si' : 'No'}</span></div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge color="#1e40af" bg="#dbeafe">
                      {getSegmentoLabel(segmento)}
                    </Badge>
                    <span className="text-[10px] text-gray-500">Tariffa: {fmtEuro(prezzoOra)}/ora</span>
                  </div>
                  {/* Dati RCA / Assicurazione */}
                  {datiEsterni.rca && (
                    <div className="mt-2 p-2 rounded-lg bg-white border border-indigo-100">
                      <div className="text-[10px] font-bold text-indigo-700 mb-1">🛡️ Dati Assicurazione (verificati)</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div><span className="text-gray-400">Compagnia:</span> <span className="font-medium text-gray-700">{datiEsterni.rca.compagniaAssicurativa}</span></div>
                        {datiEsterni.rca.numeroPolizza && (
                          <div><span className="text-gray-400">Polizza:</span> <span className="font-medium text-gray-700">{datiEsterni.rca.numeroPolizza}</span></div>
                        )}
                        {datiEsterni.rca.dataScadenzaPolizza && (
                          <div><span className="text-gray-400">Scadenza:</span> <span className="font-medium text-gray-700">{datiEsterni.rca.dataScadenzaPolizza.split('+')[0]}</span></div>
                        )}
                        <div>
                          <span className="text-gray-400">Stato:</span>{' '}
                          <span className={`font-bold ${String(datiEsterni.rca.assicurazionePresente) === 'true' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {String(datiEsterni.rca.assicurazionePresente) === 'true' ? '✅ Assicurata' : '❌ Non assicurata'}
                          </span>
                        </div>
                        {datiEsterni.rca.descrizioneTipoVeicolo && (
                          <div><span className="text-gray-400">Tipo:</span> <span className="font-medium text-gray-700">{datiEsterni.rca.descrizioneTipoVeicolo}</span></div>
                        )}
                        {datiEsterni.rca.theftstatus && (
                          <div>
                            <span className="text-gray-400">Furto:</span>{' '}
                            <span className={`font-bold ${datiEsterni.rca.theftstatus.found ? 'text-red-600' : 'text-emerald-600'}`}>
                              {datiEsterni.rca.theftstatus.found ? '⚠️ Segnalato' : '✅ Pulito'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <Badge color="#1e40af" bg="#dbeafe">
                      {getSegmentoLabel(segmento)}
                    </Badge>
                    <span className="text-[10px] text-gray-500">Tariffa: {fmtEuro(prezzoOra)}/ora</span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${datiEsterni.targa === 'MANUALE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {datiEsterni.targa === 'MANUALE' ? 'Veicolo selezionato manualmente' : datiEsterni.rca ? 'Targa verificata ✓ — dati tecnici stimati, assicurazione verificata' : 'Veicolo non in archivio — dati stimati dal database targhe'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tariffario */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">Tariffario lavorazioni</h3>
            <p className="text-[10px] text-gray-400 mb-3">Prezzi calcolati per {veicolo?.marca || datiEsterni?.marca} {veicolo?.modello || datiEsterni?.modello} (segmento {getSegmentoLabel(segmento).toLowerCase()}). Tap su una voce per aggiungerla al preventivo.</p>

            <div className="space-y-1">
              {Object.entries(perCategoria).map(([cat, voci]) => (
                <div key={cat}>
                  <button
                    onClick={() => setCategoriaAperta(categoriaAperta === cat ? null : cat)}
                    className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-gray-800">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{voci.length} voci</span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${categoriaAperta === cat ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {categoriaAperta === cat && (
                    <div className="mt-1 space-y-1 pl-2">
                      {voci.map((voce) => {
                        const costoMano = voce.manodopera.ore * voce.manodopera.prezzoOra;
                        const costoRicambi = voce.ricambi.reduce((s, r) => s + (r.prezzoMin + r.prezzoMax) / 2, 0);
                        const costoTotale = costoMano + costoRicambi;

                        return (
                          <button
                            key={voce.id}
                            onClick={() => addVoce(voce)}
                            className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800">{voce.nome}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">{voce.descrizione}</div>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                    Mano: {fmtEuro(costoMano)} ({voce.manodopera.ore}h)
                                  </span>
                                  {voce.ricambi.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                      Ricambi: {fmtEuro(costoRicambi)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <div className="text-sm font-bold text-emerald-700">{fmtEuro(costoTotale)}</div>
                                <div className="text-[10px] text-gray-400">+ IVA</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Righe preventivo */}
          {righe.length > 0 && (
            <Card className="!p-4 border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Preventivo ({righe.length} voci)</h3>
                <button
                  onClick={() => setRighe([])}
                  className="text-[10px] text-red-600 hover:text-red-800 cursor-pointer"
                >
                  Svuota tutto
                </button>
              </div>

              <div className="space-y-1.5">
                {righe.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
                    <span className={`w-1.5 h-6 rounded-full shrink-0 ${r.tipo === 'manodopera' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 truncate">{r.desc}</div>
                      <div className="text-[10px] text-gray-400">{r.tipo === 'manodopera' ? 'Manodopera' : 'Ricambio'}</div>
                    </div>
                    <input
                      type="number"
                      value={r.qta}
                      onChange={(e) => updateRigaQta(i, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 text-center text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      min={1}
                    />
                    <span className="text-[10px] text-gray-400">x</span>
                    <input
                      type="number"
                      value={r.prezzo}
                      onChange={(e) => updateRigaPrezzo(i, parseFloat(e.target.value) || 0)}
                      className="w-20 text-right text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      step={0.5}
                    />
                    <span className="text-xs font-semibold text-gray-700 w-16 text-right">{fmtEuro(r.qta * r.prezzo)}</span>
                    <button
                      onClick={() => removeRiga(i)}
                      className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Sconto */}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-600">Sconto:</span>
                <input
                  type="number"
                  value={sconto}
                  onChange={(e) => setSconto(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-16 text-center text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  min={0}
                  max={100}
                />
                <span className="text-xs text-gray-400">%</span>
                {sconto > 0 && <span className="text-xs text-red-600">-{fmtEuro(scontoEuro)}</span>}
              </div>

              {/* Note */}
              <div className="mt-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note aggiuntive (opzionale)..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Totals */}
              <div className="mt-4 pt-3 border-t-2 border-gray-300 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Manodopera</span>
                  <span>{fmtEuro(totaleManodopera)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Ricambi</span>
                  <span>{fmtEuro(totaleRicambi)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Subtotale</span>
                  <span>{fmtEuro(subtotale)}</span>
                </div>
                {sconto > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Sconto ({sconto}%)</span>
                    <span>-{fmtEuro(scontoEuro)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>IVA (22%)</span>
                  <span>{fmtEuro(iva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-blue-800 pt-1">
                  <span>TOTALE</span>
                  <span>{fmtEuro(totale)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={handleStampa}
                  className="p-3 rounded-xl border-2 border-blue-600 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  📄 Esporta PDF
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="p-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saved ? '✅ Salvato!' : saving ? 'Salvataggio...' : '💾 Salva preventivo'}
                </button>
              </div>

              {saveError && (
                <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                  ⚠️ {saveError}
                </div>
              )}

              {/* Invio WhatsApp / Email — usa il link PDF generato al salvataggio */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => {
                    const messaggioBreve = `Gentile ${cliente?.nome || 'Cliente'}, da ${officina?.nome || 'Officina'} le inviamo il preventivo per il suo veicolo ${vMarca} ${vModello}${vTarga && vTarga !== 'MANUALE' ? ` (${vTarga})` : ''}.\nTotale: ${fmtEuro(totale)}`;
                    const testo = encodeURIComponent(
                      savedPdfUrl
                        ? `${messaggioBreve}\n\n📄 Preventivo completo in PDF:\n${savedPdfUrl}\n\nResto a disposizione per qualsiasi chiarimento.\n${officina?.nome || 'Officina'}${officina?.tel ? ` — Tel: ${officina.tel}` : ''}`
                        : `${messaggioBreve}\n\nIl preventivo dettagliato verra' inviato a breve in PDF.\n${officina?.nome || 'Officina'}${officina?.tel ? ` — Tel: ${officina.tel}` : ''}`
                    );
                    const tel = cliente?.tel?.replace(/\D/g, '') || '';
                    const prefix = tel.startsWith('39') ? tel : `39${tel}`;
                    window.open(`https://wa.me/${prefix}?text=${testo}`, '_blank');
                  }}
                  disabled={!saved || uploadingSavedPdf}
                  className="p-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  📱 Invia WhatsApp
                </button>
                <button
                  onClick={() => {
                    const oggetto = encodeURIComponent(`Preventivo ${vMarca} ${vModello}${vTarga && vTarga !== 'MANUALE' ? ` (${vTarga})` : ''} — ${officina?.nome || 'Officina'}`);
                    const messaggioBreve = `Gentile ${cliente?.nome || 'Cliente'},\n\nLe inviamo il preventivo per il suo veicolo ${vMarca} ${vModello}${vTarga && vTarga !== 'MANUALE' ? ` (${vTarga})` : ''}.\nTotale: ${fmtEuro(totale)}`;
                    const corpo = encodeURIComponent(
                      (savedPdfUrl
                        ? `${messaggioBreve}\n\nIl preventivo completo in PDF e' disponibile qui:\n${savedPdfUrl}`
                        : `${messaggioBreve}\n\nIl preventivo dettagliato verra' inviato a breve.`
                      ) +
                      `\nIl preventivo e' valido 30 giorni dalla data odierna.` +
                      `\n\nPer qualsiasi domanda non esiti a contattarci.` +
                      `\n\nCordiali saluti,\n${officina?.nome || 'Officina'}` +
                      `${officina?.tel ? `\nTel: ${officina.tel}` : ''}` +
                      `${officina?.p_iva ? `\nP.IVA: ${officina.p_iva}` : ''}`
                    );
                    window.open(`mailto:${cliente?.email || ''}?subject=${oggetto}&body=${corpo}`, '_blank');
                  }}
                  disabled={!saved || uploadingSavedPdf}
                  className="p-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  ✉️ Invia Email
                </button>
              </div>
              {!saved && (
                <div className="text-center text-[10px] text-amber-600 mt-1">
                  Salva il preventivo per attivare l'invio con PDF allegato
                </div>
              )}
              {saved && uploadingSavedPdf && (
                <div className="text-center text-[10px] text-gray-400 mt-1">
                  Generazione PDF condivisibile in corso…
                </div>
              )}
              {saved && !uploadingSavedPdf && (
                <div className="text-center text-[10px] text-gray-400 mt-1">
                  {savedPdfUrl ? 'Il messaggio includera\' il link al preventivo in PDF' : 'PDF non disponibile — controlla il bucket "preventivi" su Supabase Storage'}
                </div>
              )}

              {saved && (
                <div className="text-center text-xs text-emerald-600 mt-2">
                  Preventivo salvato e collegato all'appuntamento del veicolo.
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasVeicolo && !searching && !notFound && (
        <Card className="!p-8 text-center">
          <div className="text-5xl mb-4">💰</div>
          <div className="text-sm font-semibold text-gray-700">Crea un preventivo</div>
          <div className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Inserisci la targa del veicolo o seleziona manualmente marca e modello per creare un preventivo con tariffario standard delle officine italiane.
          </div>
          <div className="grid grid-cols-2 gap-2 mt-6 max-w-xs mx-auto text-left">
            <div className="p-2 rounded-lg bg-blue-50 text-[10px] text-blue-700">
              <div className="font-bold">Manodopera</div>
              <div>€38-60/ora per segmento</div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-[10px] text-amber-700">
              <div className="font-bold">Ricambi</div>
              <div>Prezzi medi mercato IT</div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-[10px] text-emerald-700">
              <div className="font-bold">45+ lavorazioni</div>
              <div>Tariffario completo</div>
            </div>
            <div className="p-2 rounded-lg bg-purple-50 text-[10px] text-purple-700">
              <div className="font-bold">Esporta PDF</div>
              <div>Preventivo professionale</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// PREVENTIVI PAGE — List + Search + New
// ============================================================

interface PreventivoListItem {
  id: string;
  subtotale: number;
  sconto: number;
  iva: number;
  totale: number;
  stato: string;
  created_at: string;
  appuntamento_id: string;
  righe: { tipo: 'manodopera' | 'ricambio'; desc: string; qta: number; prezzo: number }[];
  cliente_nome?: string;
  veicolo_targa?: string;
  veicolo_desc?: string;
}

export function PreventiviPage({ onSelectAppuntamento, onNavigateToCalendar, externalSearch, resetSignal }: { onSelectAppuntamento?: (app: any) => void; onNavigateToCalendar?: (date: Date) => void; externalSearch?: string; resetSignal?: number }) {
  const { officina } = useAuthStore();
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedPreventivo, setSelectedPreventivo] = useState<PreventivoListItem | null>(null);
  const [detailAppuntamento, setDetailAppuntamento] = useState<Appuntamento | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editRighe, setEditRighe] = useState<PreventivoListItem['righe']>([]);
  const [editSconto, setEditSconto] = useState(0);
  const [editClienteNome, setEditClienteNome] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Quando l'utente clicca di nuovo sul tab Preventivi mentre e' gia' attivo,
  // torna alla lista principale invece di restare nel dettaglio/creazione.
  useEffect(() => {
    if (resetSignal === undefined) return;
    setView('list');
    setSelectedPreventivo(null);
    setEditMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useEffect(() => {
    if (view !== 'detail' || !selectedPreventivo?.appuntamento_id) {
      setDetailAppuntamento(null);
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*, clienti(id,nome,email,tel), veicoli(marca,modello,targa,km)')
        .eq('id', selectedPreventivo.appuntamento_id)
        .single();
      if (!cancelled) setDetailAppuntamento(data as Appuntamento | null);
    })();
    return () => { cancelled = true; };
  }, [view, selectedPreventivo?.appuntamento_id]);

  // Genera HTML del preventivo e lo carica su Supabase Storage per condivisione
  useEffect(() => {
    if (view !== 'detail' || !selectedPreventivo || !detailAppuntamento) return;
    let cancelled = false;
    (async () => {
      setUploadingPdf(true);
      try {
        const accent = await extractLogoColor(officina?.logo_url);
        const html = buildPreventivoHtml(
          detailAppuntamento,
          {
            id: selectedPreventivo.id,
            appuntamento_id: selectedPreventivo.appuntamento_id,
            righe: selectedPreventivo.righe,
            subtotale: selectedPreventivo.subtotale,
            sconto: selectedPreventivo.sconto,
            iva: selectedPreventivo.iva,
            totale: selectedPreventivo.totale,
            stato: selectedPreventivo.stato as 'bozza' | 'inviato' | 'accettato' | 'rifiutato',
            created_at: selectedPreventivo.created_at,
          },
          officina,
          accent
        );
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const path = `${officina?.id || 'anon'}/preventivo-${selectedPreventivo.id}.html`;
        const { error: upErr } = await supabase.storage
          .from('preventivi')
          .upload(path, blob, { upsert: true, contentType: 'text/html; charset=utf-8' });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('preventivi').getPublicUrl(path);
          if (!cancelled) setPdfUrl(pub.publicUrl);
        } else if (!cancelled) {
          // Bucket "preventivi" non esiste — proseguo senza link pubblico
          setPdfUrl(null);
        }
      } finally {
        if (!cancelled) setUploadingPdf(false);
      }
    })();
    return () => { cancelled = true; };
  }, [view, selectedPreventivo, detailAppuntamento, officina]);
  const [preventivi, setPreventivi] = useState<PreventivoListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState(externalSearch || '');

  // Update search when external search changes (from global search)
  useEffect(() => {
    if (externalSearch) {
      setSearchQuery(externalSearch);
      setView('list');
    }
  }, [externalSearch]);

  // Fetch preventivi with joined data
  useEffect(() => {
    if (!officina?.id || view !== 'list') return;
    (async () => {
      setLoadingList(true);
      const { data: apps } = await supabase
        .from('appuntamenti')
        .select('id, cliente_id, veicolo_id')
        .eq('officina_id', officina.id);

      if (!apps?.length) { setPreventivi([]); setLoadingList(false); return; }

      const appIds = apps.map(a => a.id);
      const { data: prevs } = await supabase
        .from('preventivi')
        .select('*')
        .in('appuntamento_id', appIds)
        .order('created_at', { ascending: false });

      if (!prevs?.length) { setPreventivi([]); setLoadingList(false); return; }

      // Fetch clienti and veicoli for display
      const clienteIds = [...new Set(apps.map(a => a.cliente_id).filter(Boolean))];
      const veicoloIds = [...new Set(apps.map(a => a.veicolo_id).filter(Boolean))];

      const [clientiRes, veicoliRes] = await Promise.all([
        clienteIds.length ? supabase.from('clienti').select('id, nome').in('id', clienteIds) : { data: [] },
        veicoloIds.length ? supabase.from('veicoli').select('id, marca, modello, targa').in('id', veicoloIds) : { data: [] },
      ]);

      const clientiMap = Object.fromEntries((clientiRes.data || []).map(c => [c.id, c]));
      const veicoliMap = Object.fromEntries((veicoliRes.data || []).map(v => [v.id, v]));

      const enriched: PreventivoListItem[] = prevs.map(p => {
        const app = apps.find(a => a.id === p.appuntamento_id);
        const cl = app?.cliente_id ? clientiMap[app.cliente_id] : null;
        const ve = app?.veicolo_id ? veicoliMap[app.veicolo_id] : null;
        return {
          ...p,
          righe: p.righe || [],
          cliente_nome: cl?.nome || 'Cliente sconosciuto',
          veicolo_targa: ve?.targa || '',
          veicolo_desc: ve ? `${ve.marca} ${ve.modello}` : '',
        };
      });

      setPreventivi(enriched);
      setLoadingList(false);
    })();
  }, [officina?.id, view]);

  // Filter preventivi by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return preventivi;
    const q = searchQuery.toLowerCase();
    return preventivi.filter(p =>
      (p.cliente_nome?.toLowerCase().includes(q)) ||
      (p.veicolo_targa?.toLowerCase().includes(q)) ||
      (p.veicolo_desc?.toLowerCase().includes(q))
    );
  }, [preventivi, searchQuery]);

  const statoBadge = (stato: string) => {
    const map: Record<string, { color: string; label: string }> = {
      bozza: { color: 'bg-gray-100 text-gray-700', label: 'Bozza' },
      inviato: { color: 'bg-blue-100 text-blue-700', label: 'Inviato' },
      accettato: { color: 'bg-green-100 text-green-700', label: 'Accettato' },
      rifiutato: { color: 'bg-red-100 text-red-700', label: 'Rifiutato' },
    };
    const s = map[stato] || map.bozza;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.color}`}>{s.label}</span>;
  };

  if (view === 'new') {
    return <PreventivoBuilder onBack={() => setView('list')} />;
  }

  if (view === 'detail' && selectedPreventivo) {
    const p = selectedPreventivo;
    const statoMap: Record<string, { label: string; color: string; bg: string }> = {
      bozza: { label: 'Bozza', color: '#6b7280', bg: '#f3f4f6' },
      inviato: { label: 'Inviato', color: '#3b82f6', bg: '#dbeafe' },
      accettato: { label: 'Accettato', color: '#10b981', bg: '#d1fae5' },
      rifiutato: { label: 'Rifiutato', color: '#ef4444', bg: '#fee2e2' },
    };
    const statoInfo = statoMap[p.stato] || statoMap.bozza;

    const subtotaleView = editMode
      ? editRighe.reduce((s, r) => s + r.qta * r.prezzo, 0)
      : p.subtotale;
    const ivaView = editMode ? (subtotaleView - editSconto) * 0.22 : p.iva;
    const totaleView = editMode ? (subtotaleView - editSconto) + ivaView : p.totale;

    const startEdit = () => {
      setEditRighe(p.righe.map((r) => ({ ...r })));
      setEditSconto(p.sconto);
      setEditClienteNome(p.cliente_nome || '');
      setEditMode(true);
    };

    const cancelEdit = () => {
      setEditMode(false);
      setEditRighe([]);
      setEditSconto(0);
      setEditClienteNome('');
    };

    const saveEdit = async () => {
      setSavingEdit(true);
      const nuovoSubtotale = editRighe.reduce((s, r) => s + r.qta * r.prezzo, 0);
      const nuovaIva = (nuovoSubtotale - editSconto) * 0.22;
      const nuovoTotale = (nuovoSubtotale - editSconto) + nuovaIva;
      const { error: updErr } = await supabase
        .from('preventivi')
        .update({
          righe: editRighe,
          subtotale: nuovoSubtotale,
          sconto: editSconto,
          iva: nuovaIva,
          totale: nuovoTotale,
        })
        .eq('id', p.id);
      if (updErr) {
        setSavingEdit(false);
        alert('Errore salvataggio modifiche: ' + updErr.message);
        return;
      }

      // Il nome cliente vive sulla tabella clienti, collegata tramite l'appuntamento.
      const nuovoNome = editClienteNome.trim();
      const clienteId = detailAppuntamento?.cliente_id;
      const nomeCambiato = !!nuovoNome && nuovoNome !== (p.cliente_nome || '');
      if (nomeCambiato && clienteId) {
        const { error: cliErr } = await supabase
          .from('clienti')
          .update({ nome: nuovoNome })
          .eq('id', clienteId);
        if (cliErr) {
          setSavingEdit(false);
          alert('Preventivo salvato, ma il nome cliente non e stato aggiornato: ' + cliErr.message);
          return;
        }
        setDetailAppuntamento((prev) =>
          prev ? { ...prev, clienti: prev.clienti ? { ...prev.clienti, nome: nuovoNome } : prev.clienti } : prev
        );
      }
      setSavingEdit(false);

      const nomeFinale = nomeCambiato && clienteId ? nuovoNome : p.cliente_nome;
      const updated: PreventivoListItem = {
        ...p,
        righe: editRighe,
        subtotale: nuovoSubtotale,
        sconto: editSconto,
        iva: nuovaIva,
        totale: nuovoTotale,
        cliente_nome: nomeFinale,
      };
      setSelectedPreventivo(updated);
      setPreventivi((prev) =>
        prev.map((x) => {
          if (x.id === p.id) return updated;
          // Rinominare il cliente si riflette su tutti i suoi preventivi.
          if (nomeCambiato && clienteId && x.cliente_nome === p.cliente_nome) {
            return { ...x, cliente_nome: nuovoNome };
          }
          return x;
        })
      );
      setEditMode(false);
    };

    return (
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setSelectedPreventivo(null); setEditMode(false); }} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            {editMode ? (
              <input
                value={editClienteNome}
                onChange={(e) => setEditClienteNome(e.target.value)}
                placeholder="Nome cliente"
                aria-label="Nome cliente"
                className="w-full font-bold text-gray-900 text-base border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <h2 className="font-bold text-gray-900 text-base">{p.cliente_nome}</h2>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {p.veicolo_desc && <span className="text-xs text-gray-500">{p.veicolo_desc}</span>}
              {p.veicolo_targa && (
                <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold">{p.veicolo_targa}</span>
              )}
            </div>
          </div>
          {!editMode && (
            <button
              onClick={startEdit}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
            >
              ✏️ Modifica
            </button>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: statoInfo.bg, color: statoInfo.color }}>
            {statoInfo.label}
          </span>
        </div>

        {/* Data */}
        <div className="text-xs text-gray-400">
          Creato il {new Date(p.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Voci preventivo */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Voci preventivo</span>
            {editMode && (
              <span className="text-[10px] text-blue-600 font-semibold">Modifica in corso</span>
            )}
          </div>
          {!editMode ? (
            p.righe.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Nessuna voce</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {p.righe.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.tipo === 'manodopera' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.tipo === 'manodopera' ? '🔧 Manodopera' : '📦 Ricambio'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">{r.desc}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.qta} × {fmtEuro(r.prezzo)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 shrink-0">
                      {fmtEuro(r.qta * r.prezzo)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="divide-y divide-gray-100">
              {editRighe.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">Nessuna voce</div>
              ) : (
                editRighe.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.tipo === 'manodopera' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.tipo === 'manodopera' ? '🔧' : '📦'}
                      </span>
                      <div className="text-sm text-gray-800 mt-0.5 truncate">{r.desc}</div>
                    </div>
                    <input
                      type="number"
                      value={r.qta}
                      onChange={(e) => setEditRighe((prev) => prev.map((x, idx) => idx === i ? { ...x, qta: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                      className="w-12 text-center text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      min={1}
                    />
                    <span className="text-[10px] text-gray-400">×</span>
                    <input
                      type="number"
                      value={r.prezzo}
                      onChange={(e) => setEditRighe((prev) => prev.map((x, idx) => idx === i ? { ...x, prezzo: parseFloat(e.target.value) || 0 } : x))}
                      className="w-20 text-right text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      step={0.5}
                    />
                    <button
                      onClick={() => setEditRighe((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Sconto (€)</span>
                <input
                  type="number"
                  value={editSconto}
                  onChange={(e) => setEditSconto(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 text-right text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  step={0.5}
                  min={0}
                />
              </div>
            </div>
          )}
        </div>

        {/* Totali */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotale</span>
            <span>{fmtEuro(subtotaleView)}</span>
          </div>
          {(editMode ? editSconto > 0 : p.sconto > 0) && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Sconto</span>
              <span>− {fmtEuro(editMode ? editSconto : p.sconto)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>IVA 22%</span>
            <span>{fmtEuro(ivaView)}</span>
          </div>
          <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
            <span>TOTALE</span>
            <span>{fmtEuro(totaleView)}</span>
          </div>
        </div>

        {editMode && (
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {savingEdit ? 'Salvataggio...' : '💾 Salva modifiche'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={savingEdit}
              className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Annulla
            </button>
          </div>
        )}

        {/* Esporta PDF + Invia (email/WhatsApp/SMS) */}
        {!editMode && detailAppuntamento && (
          <div className="space-y-2">
            <PDFExport
              appuntamento={detailAppuntamento}
              preventivo={{
                id: p.id,
                appuntamento_id: p.appuntamento_id,
                righe: p.righe,
                subtotale: p.subtotale,
                sconto: p.sconto,
                iva: p.iva,
                totale: p.totale,
                stato: p.stato as 'bozza' | 'inviato' | 'accettato' | 'rifiutato',
                created_at: p.created_at,
              }}
            />
            {/* Finche' il link non e' pronto l'invio partirebbe senza allegato. */}
            <div className={uploadingPdf ? 'opacity-50 pointer-events-none' : ''}>
            <ShareDocument
              tipo="preventivo"
              titolo="preventivo"
              clienteEmail={detailAppuntamento.clienti?.email}
              clienteTel={detailAppuntamento.clienti?.tel}
              clienteNome={detailAppuntamento.clienti?.nome}
              officinaId={officina?.id}
              clienteId={detailAppuntamento.cliente_id}
              pdfUrl={pdfUrl}
              fileName={`Preventivo-${(p.cliente_nome || 'cliente').replace(/[^\w-]+/g, '_')}.html`}
              getDocumentHtml={async () => {
                const accent = await extractLogoColor(officina?.logo_url);
                return buildPreventivoHtml(
                  detailAppuntamento,
                  {
                    id: p.id,
                    appuntamento_id: p.appuntamento_id,
                    righe: p.righe,
                    subtotale: p.subtotale,
                    sconto: p.sconto,
                    iva: p.iva,
                    totale: p.totale,
                    stato: p.stato as 'bozza' | 'inviato' | 'accettato' | 'rifiutato',
                    created_at: p.created_at,
                  },
                  officina,
                  accent
                );
              }}
              emailSubject={`Preventivo ${detailAppuntamento.veicoli ? detailAppuntamento.veicoli.marca + ' ' + detailAppuntamento.veicoli.modello : ''}${detailAppuntamento.veicoli?.targa ? ' (' + detailAppuntamento.veicoli.targa + ')' : ''} — ${officina?.nome || 'OfficinAI'}`}
              emailData={{
                clienteNome: detailAppuntamento.clienti?.nome || 'Cliente',
                veicolo: detailAppuntamento.veicoli
                  ? `${detailAppuntamento.veicoli.marca} ${detailAppuntamento.veicoli.modello}`
                  : '',
                totale: fmtEuro(p.totale),
                linkPreventivo: pdfUrl || undefined,
              }}
              whatsappText={`Buongiorno ${detailAppuntamento.clienti?.nome || ''}, le inviamo il preventivo per il suo ${
                detailAppuntamento.veicoli
                  ? `${detailAppuntamento.veicoli.marca} ${detailAppuntamento.veicoli.modello}`
                  : 'veicolo'
              }${detailAppuntamento.veicoli?.targa ? ` (${detailAppuntamento.veicoli.targa})` : ''}.\nTotale: ${fmtEuro(p.totale)}\n\nResto a disposizione per qualsiasi chiarimento.\n— ${officina?.nome || 'OfficinAI'}`}
            />
            </div>
            {uploadingPdf && (
              <div className="text-[11px] text-gray-400 text-center">Generazione link preventivo…</div>
            )}
            {!uploadingPdf && !pdfUrl && (
              <div className="text-[11px] text-amber-600 text-center">
                Il messaggio non contiene un link: usa «Allega documento» per inviare il preventivo come file.
                Per avere invece un link automatico, crea il bucket <code className="font-mono bg-amber-50 px-1 rounded">preventivi</code> (pubblico) su Supabase Storage.
              </div>
            )}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-blue-600 hover:underline"
              >
                📎 Apri preventivo condivisibile (pagina web)
              </a>
            )}
          </div>
        )}

        {/* Azioni */}
        {!editMode && (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const { data } = await supabase.from('appuntamenti').select('*, clienti(nome,tel), veicoli(marca,modello,targa)').eq('id', p.appuntamento_id).single();
                if (data && onSelectAppuntamento) onSelectAppuntamento(data);
              }}
              className="flex-1 py-3 rounded-xl border-2 border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 cursor-pointer transition-colors"
            >
              📅 Vai all'appuntamento
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Preventivi</h2>
          <p className="text-xs text-gray-500">{preventivi.length} preventiv{preventivi.length === 1 ? 'o' : 'i'} totali</p>
        </div>
        <button
          onClick={() => setView('new')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          + Nuovo Preventivo
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca per nome cliente o targa..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
        />
      </div>

      {/* List */}
      {loadingList ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" text="Caricamento preventivi..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">
            {searchQuery ? 'Nessun risultato' : 'Nessun preventivo'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery ? 'Prova a cambiare i termini di ricerca' : 'Crea il tuo primo preventivo'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setView('new')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              + Nuovo Preventivo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => { setSelectedPreventivo(p); setView('detail'); }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm">{p.cliente_nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.veicolo_desc && <span>{p.veicolo_desc}</span>}
                    {p.veicolo_targa && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono font-bold">{p.veicolo_targa}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-gray-900 dark:text-white">{fmtEuro(p.totale)}</div>
                  {statoBadge(p.stato)}
                </div>
              </div>
              <div className="text-[10px] text-gray-400">
                {new Date(p.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
