/**
 * Servizio di ricerca veicolo per targa.
 *
 * Flusso:
 * 1. Cerca nel DB locale (clienti esistenti)
 * 2. Se non trovato, interroga API esterna (dati pubblici veicolo)
 * 3. Restituisce marca, modello, anno, alimentazione, cilindrata, potenza, ecc.
 */

export interface DatiVeicolo {
  targa: string;
  marca: string;
  modello: string;
  anno: number;
  carburante: string;
  cilindrata?: string;
  potenzaKw?: number;
  potenzaCv?: number;
  classe?: string;       // Segmento (berlina, suv, ecc.)
  colore?: string;
  telaio?: string;
  neopatentati?: boolean;
  euroClasse?: string;   // Euro 6, Euro 5, ecc.
  posti?: number;
  peso?: number;         // Massa kg
  // Se trovato nel DB locale
  daDatabase?: boolean;
  clienteId?: string;
  clienteNome?: string;
  veicoloId?: string;
  km?: number;
  // Dati RCA (da RapidAPI)
  rca?: DatiRCA;
}

export interface DatiRCA {
  tipoVeicolo?: string;
  descrizioneTipoVeicolo?: string;
  compagniaAssicurativa?: string;
  numeroPolizza?: string;
  dataScadenzaPolizza?: string;
  assicurazionePresente?: boolean | string;
  assicurazioneSospesa?: boolean | string;
  theftstatus?: { success: boolean; found: boolean; message?: string } | null;
}

// ============================================================
// DATABASE MODELLI ITALIANI (per generazione realistica)
// ============================================================

export interface ModelloAuto {
  marca: string;
  modelli: { nome: string; anni: [number, number]; carburanti: string[]; cilindrate: string[]; kwRange: [number, number]; classe: string }[];
}

export const DB_AUTO: ModelloAuto[] = [
  {
    marca: 'Fiat',
    modelli: [
      { nome: 'Panda', anni: [2012, 2026], carburanti: ['Benzina', 'GPL', 'Metano', 'Ibrida'], cilindrate: ['999', '1242', '875'], kwRange: [51, 70], classe: 'Utilitaria' },
      { nome: '500', anni: [2007, 2026], carburanti: ['Benzina', 'Ibrida', 'Elettrica'], cilindrate: ['875', '1242', '1368'], kwRange: [51, 77], classe: 'Utilitaria' },
      { nome: 'Tipo', anni: [2015, 2026], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['1368', '1598', '1248'], kwRange: [70, 88], classe: 'Berlina' },
      { nome: 'Punto', anni: [2005, 2018], carburanti: ['Benzina', 'Diesel', 'GPL', 'Metano'], cilindrate: ['1242', '1368', '1248'], kwRange: [48, 77], classe: 'Utilitaria' },
      { nome: '500X', anni: [2014, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1598'], kwRange: [88, 125], classe: 'SUV' },
      { nome: '500L', anni: [2012, 2024], carburanti: ['Benzina', 'Diesel', 'Metano'], cilindrate: ['1368', '1598'], kwRange: [70, 88], classe: 'Monovolume' },
      { nome: 'Ducato', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2287', '2999'], kwRange: [96, 132], classe: 'Commerciale' },
      { nome: 'Doblò', anni: [2010, 2024], carburanti: ['Diesel', 'Benzina', 'Metano'], cilindrate: ['1248', '1368', '1598'], kwRange: [66, 88], classe: 'Commerciale' },
      { nome: '600', anni: [2023, 2026], carburanti: ['Benzina', 'Ibrida', 'Elettrica'], cilindrate: ['1199', '1332'], kwRange: [74, 115], classe: 'SUV' },
      { nome: 'Fiorino', anni: [2007, 2024], carburanti: ['Diesel', 'Benzina', 'Metano'], cilindrate: ['1248', '1368'], kwRange: [55, 70], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Volkswagen',
    modelli: [
      { nome: 'Golf', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida', 'Metano'], cilindrate: ['999', '1498', '1968'], kwRange: [66, 140], classe: 'Berlina' },
      { nome: 'Polo', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498', '1598'], kwRange: [55, 85], classe: 'Utilitaria' },
      { nome: 'Tiguan', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1498', '1968'], kwRange: [110, 162], classe: 'SUV' },
      { nome: 'T-Roc', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'SUV' },
      { nome: 'Passat', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 140], classe: 'Berlina' },
      { nome: 'T-Cross', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498'], kwRange: [70, 110], classe: 'SUV' },
      { nome: 'Transporter', anni: [2003, 2026], carburanti: ['Diesel'], cilindrate: ['1968', '2461'], kwRange: [62, 150], classe: 'Commerciale' },
      { nome: 'Up!', anni: [2011, 2023], carburanti: ['Benzina', 'Metano'], cilindrate: ['999'], kwRange: [44, 55], classe: 'Utilitaria' },
      { nome: 'Touran', anni: [2003, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [81, 140], classe: 'Monovolume' },
      { nome: 'Caddy', anni: [2004, 2026], carburanti: ['Diesel', 'Benzina', 'Metano'], cilindrate: ['1598', '1968'], kwRange: [55, 110], classe: 'Commerciale' },
      { nome: 'ID.3', anni: [2020, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [110, 150], classe: 'Berlina' },
      { nome: 'ID.4', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [125, 220], classe: 'SUV' },
      { nome: 'Taigo', anni: [2021, 2026], carburanti: ['Benzina'], cilindrate: ['999', '1498'], kwRange: [70, 110], classe: 'SUV' },
    ],
  },
  {
    marca: 'Ford',
    modelli: [
      { nome: 'Fiesta', anni: [2008, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1496', '1499'], kwRange: [55, 103], classe: 'Utilitaria' },
      { nome: 'Focus', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['999', '1496', '1499', '1997'], kwRange: [74, 110], classe: 'Berlina' },
      { nome: 'Puma', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['999', '1496'], kwRange: [92, 114], classe: 'SUV' },
      { nome: 'Kuga', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1496', '1499', '2488'], kwRange: [88, 140], classe: 'SUV' },
      { nome: 'Transit', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['1996', '2198'], kwRange: [74, 125], classe: 'Commerciale' },
      { nome: 'Transit Custom', anni: [2012, 2026], carburanti: ['Diesel', 'Ibrida'], cilindrate: ['1996', '2198'], kwRange: [77, 136], classe: 'Commerciale' },
      { nome: 'EcoSport', anni: [2014, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1496', '1499'], kwRange: [74, 103], classe: 'SUV' },
      { nome: 'Ka+', anni: [2016, 2021], carburanti: ['Benzina'], cilindrate: ['1198', '1498'], kwRange: [51, 63], classe: 'Utilitaria' },
      { nome: 'Mondeo', anni: [2007, 2022], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1499', '1997', '1999'], kwRange: [88, 150], classe: 'Berlina' },
      { nome: 'Mustang Mach-E', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [198, 358], classe: 'SUV' },
      { nome: 'Tourneo Connect', anni: [2013, 2026], carburanti: ['Diesel', 'Benzina'], cilindrate: ['1499', '1996'], kwRange: [74, 88], classe: 'Monovolume' },
      { nome: 'Ranger', anni: [2012, 2026], carburanti: ['Diesel'], cilindrate: ['1996', '2198', '2993'], kwRange: [96, 155], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Toyota',
    modelli: [
      { nome: 'Yaris', anni: [2005, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['998', '1497', '1490'], kwRange: [51, 85], classe: 'Utilitaria' },
      { nome: 'Corolla', anni: [2019, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['1798', '1987'], kwRange: [90, 144], classe: 'Berlina' },
      { nome: 'RAV4', anni: [2013, 2026], carburanti: ['Ibrida', 'Benzina', 'Diesel'], cilindrate: ['2487', '1987'], kwRange: [110, 163], classe: 'SUV' },
      { nome: 'C-HR', anni: [2016, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['1798', '1987'], kwRange: [90, 144], classe: 'SUV' },
      { nome: 'Aygo', anni: [2005, 2023], carburanti: ['Benzina'], cilindrate: ['998'], kwRange: [51, 53], classe: 'Utilitaria' },
      { nome: 'Aygo X', anni: [2022, 2026], carburanti: ['Benzina'], cilindrate: ['999'], kwRange: [53, 53], classe: 'Utilitaria' },
      { nome: 'Yaris Cross', anni: [2021, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['1490'], kwRange: [85, 96], classe: 'SUV' },
      { nome: 'Land Cruiser', anni: [2009, 2026], carburanti: ['Diesel', 'Benzina'], cilindrate: ['2755', '2982', '3956'], kwRange: [130, 227], classe: 'SUV' },
      { nome: 'Hilux', anni: [2005, 2026], carburanti: ['Diesel'], cilindrate: ['2393', '2755'], kwRange: [106, 150], classe: 'Commerciale' },
      { nome: 'Proace', anni: [2016, 2026], carburanti: ['Diesel', 'Elettrica'], cilindrate: ['1499', '1997'], kwRange: [74, 130], classe: 'Commerciale' },
      { nome: 'Proace City', anni: [2020, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [55, 96], classe: 'Commerciale' },
      { nome: 'bZ4X', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [150, 160], classe: 'SUV' },
    ],
  },
  {
    marca: 'Renault',
    modelli: [
      { nome: 'Clio', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['999', '1197', '1461', '1598'], kwRange: [48, 96], classe: 'Utilitaria' },
      { nome: 'Captur', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['999', '1197', '1332', '1461'], kwRange: [66, 96], classe: 'SUV' },
      { nome: 'Mégane', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1197', '1332', '1461'], kwRange: [74, 118], classe: 'Berlina' },
      { nome: 'Kadjar', anni: [2015, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1197', '1332', '1461'], kwRange: [96, 118], classe: 'SUV' },
      { nome: 'Twingo', anni: [2007, 2024], carburanti: ['Benzina', 'Elettrica'], cilindrate: ['898', '999'], kwRange: [44, 66], classe: 'Utilitaria' },
      { nome: 'Scénic', anni: [2009, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1197', '1332', '1461', '1598'], kwRange: [74, 118], classe: 'Monovolume' },
      { nome: 'Kangoo', anni: [2008, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1197', '1332', '1461'], kwRange: [55, 96], classe: 'Commerciale' },
      { nome: 'Trafic', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['1598', '1997'], kwRange: [66, 125], classe: 'Commerciale' },
      { nome: 'Master', anni: [2010, 2026], carburanti: ['Diesel'], cilindrate: ['2299'], kwRange: [92, 125], classe: 'Commerciale' },
      { nome: 'Arkana', anni: [2021, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1332', '1598'], kwRange: [96, 103], classe: 'SUV' },
      { nome: 'Austral', anni: [2022, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1199', '1332'], kwRange: [96, 147], classe: 'SUV' },
      { nome: 'Zoe', anni: [2013, 2024], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [65, 100], classe: 'Utilitaria' },
    ],
  },
  {
    marca: 'BMW',
    modelli: [
      { nome: 'Serie 1', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1499', '1998'], kwRange: [80, 140], classe: 'Berlina' },
      { nome: 'Serie 3', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1998', '2993'], kwRange: [110, 190], classe: 'Berlina' },
      { nome: 'X1', anni: [2015, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1499', '1998'], kwRange: [100, 170], classe: 'SUV' },
      { nome: 'X3', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1998', '2993'], kwRange: [135, 210], classe: 'SUV' },
      { nome: 'Serie 2 Active Tourer', anni: [2014, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1499', '1998'], kwRange: [100, 170], classe: 'Monovolume' },
      { nome: 'Serie 2 Gran Coupé', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1499', '1998'], kwRange: [85, 140], classe: 'Berlina' },
      { nome: 'Serie 4', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1998', '2993'], kwRange: [135, 275], classe: 'Coupé' },
      { nome: 'Serie 5', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1998', '2993'], kwRange: [140, 250], classe: 'Berlina' },
      { nome: 'X2', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1499', '1998'], kwRange: [100, 170], classe: 'SUV' },
      { nome: 'X5', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2993', '4395'], kwRange: [173, 340], classe: 'SUV' },
      { nome: 'iX1', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [150, 230], classe: 'SUV' },
      { nome: 'i4', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [250, 400], classe: 'Berlina' },
    ],
  },
  {
    marca: 'Audi',
    modelli: [
      { nome: 'A1', anni: [2010, 2026], carburanti: ['Benzina'], cilindrate: ['999', '1498'], kwRange: [70, 110], classe: 'Utilitaria' },
      { nome: 'A3', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel', 'Metano'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'Berlina' },
      { nome: 'A4', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1984', '1968', '2995'], kwRange: [110, 180], classe: 'Berlina' },
      { nome: 'Q3', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 170], classe: 'SUV' },
      { nome: 'Q5', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1984', '2995'], kwRange: [140, 210], classe: 'SUV' },
      { nome: 'A5', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1984', '1968', '2995'], kwRange: [110, 210], classe: 'Coupé' },
      { nome: 'A6', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1984', '2967', '2995'], kwRange: [140, 250], classe: 'Berlina' },
      { nome: 'Q2', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'SUV' },
      { nome: 'Q7', anni: [2006, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2995', '2967'], kwRange: [183, 270], classe: 'SUV' },
      { nome: 'Q8', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2995', '3996'], kwRange: [210, 340], classe: 'SUV' },
      { nome: 'e-tron', anni: [2019, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [230, 370], classe: 'SUV' },
      { nome: 'Q4 e-tron', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [125, 220], classe: 'SUV' },
    ],
  },
  {
    marca: 'Mercedes-Benz',
    modelli: [
      { nome: 'Classe A', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1461', '1991'], kwRange: [80, 140], classe: 'Berlina' },
      { nome: 'Classe B', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1461'], kwRange: [80, 120], classe: 'Monovolume' },
      { nome: 'Classe C', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1496', '1991', '2996'], kwRange: [115, 190], classe: 'Berlina' },
      { nome: 'GLA', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1991'], kwRange: [100, 165], classe: 'SUV' },
      { nome: 'GLC', anni: [2015, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1991', '2996'], kwRange: [143, 200], classe: 'SUV' },
      { nome: 'Vito', anni: [2003, 2026], carburanti: ['Diesel'], cilindrate: ['1598', '2143'], kwRange: [65, 140], classe: 'Commerciale' },
      { nome: 'Sprinter', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2143', '2987'], kwRange: [84, 140], classe: 'Commerciale' },
      { nome: 'Classe E', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1991', '2996', '2925'], kwRange: [143, 270], classe: 'Berlina' },
      { nome: 'GLB', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1991'], kwRange: [100, 165], classe: 'SUV' },
      { nome: 'GLE', anni: [2015, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1991', '2925', '2999'], kwRange: [143, 330], classe: 'SUV' },
      { nome: 'CLA', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1332', '1991'], kwRange: [80, 165], classe: 'Berlina' },
      { nome: 'EQA', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [140, 215], classe: 'SUV' },
      { nome: 'EQB', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [140, 215], classe: 'SUV' },
      { nome: 'Citan', anni: [2012, 2026], carburanti: ['Diesel', 'Benzina'], cilindrate: ['1332', '1461'], kwRange: [55, 96], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Peugeot',
    modelli: [
      { nome: '208', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [55, 96], classe: 'Utilitaria' },
      { nome: '308', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1560'], kwRange: [81, 132], classe: 'Berlina' },
      { nome: '2008', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [74, 114], classe: 'SUV' },
      { nome: '3008', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1598'], kwRange: [96, 165], classe: 'SUV' },
      { nome: '108', anni: [2014, 2021], carburanti: ['Benzina'], cilindrate: ['998'], kwRange: [50, 51], classe: 'Utilitaria' },
      { nome: '508', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1499', '1598', '1997'], kwRange: [96, 165], classe: 'Berlina' },
      { nome: '5008', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1598'], kwRange: [96, 165], classe: 'SUV' },
      { nome: 'Partner', anni: [2008, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1499', '1560'], kwRange: [55, 96], classe: 'Commerciale' },
      { nome: 'Expert', anni: [2007, 2026], carburanti: ['Diesel', 'Elettrica'], cilindrate: ['1499', '1997'], kwRange: [74, 130], classe: 'Commerciale' },
      { nome: 'Boxer', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2179', '2999'], kwRange: [88, 121], classe: 'Commerciale' },
      { nome: 'Rifter', anni: [2018, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [74, 96], classe: 'Monovolume' },
    ],
  },
  {
    marca: 'Citroën',
    modelli: [
      { nome: 'C3', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1199', '1499'], kwRange: [50, 81], classe: 'Utilitaria' },
      { nome: 'C3 Aircross', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1199', '1499'], kwRange: [81, 96], classe: 'SUV' },
      { nome: 'C4', anni: [2020, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [74, 114], classe: 'Berlina' },
      { nome: 'Berlingo', anni: [2008, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1499', '1560'], kwRange: [55, 96], classe: 'Commerciale' },
      { nome: 'C1', anni: [2005, 2021], carburanti: ['Benzina'], cilindrate: ['998'], kwRange: [50, 51], classe: 'Utilitaria' },
      { nome: 'C5 Aircross', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1598'], kwRange: [96, 165], classe: 'SUV' },
      { nome: 'C4 Cactus', anni: [2014, 2020], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1199', '1560'], kwRange: [55, 81], classe: 'SUV' },
      { nome: 'Jumpy', anni: [2007, 2026], carburanti: ['Diesel', 'Elettrica'], cilindrate: ['1499', '1997'], kwRange: [74, 130], classe: 'Commerciale' },
      { nome: 'Jumper', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2179', '2999'], kwRange: [88, 121], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Opel',
    modelli: [
      { nome: 'Corsa', anni: [2006, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1398', '1499'], kwRange: [51, 96], classe: 'Utilitaria' },
      { nome: 'Astra', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1399', '1598'], kwRange: [74, 132], classe: 'Berlina' },
      { nome: 'Mokka', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1364', '1598'], kwRange: [74, 114], classe: 'SUV' },
      { nome: 'Crossland', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1199', '1499'], kwRange: [61, 96], classe: 'SUV' },
      { nome: 'Grandland', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1598'], kwRange: [96, 165], classe: 'SUV' },
      { nome: 'Insignia', anni: [2008, 2022], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1399', '1598', '1956', '1998'], kwRange: [88, 147], classe: 'Berlina' },
      { nome: 'Karl', anni: [2015, 2019], carburanti: ['Benzina'], cilindrate: ['999'], kwRange: [55, 55], classe: 'Utilitaria' },
      { nome: 'Meriva', anni: [2006, 2017], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1229', '1364', '1398', '1686'], kwRange: [55, 88], classe: 'Monovolume' },
      { nome: 'Combo', anni: [2011, 2026], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1248', '1499', '1560'], kwRange: [55, 96], classe: 'Commerciale' },
      { nome: 'Vivaro', anni: [2006, 2026], carburanti: ['Diesel', 'Elettrica'], cilindrate: ['1499', '1598', '1997'], kwRange: [74, 130], classe: 'Commerciale' },
      { nome: 'Movano', anni: [2010, 2026], carburanti: ['Diesel'], cilindrate: ['2299'], kwRange: [92, 125], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Hyundai',
    modelli: [
      { nome: 'i10', anni: [2013, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['998', '1248'], kwRange: [49, 62], classe: 'Utilitaria' },
      { nome: 'i20', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1248', '1396'], kwRange: [55, 74], classe: 'Utilitaria' },
      { nome: 'i30', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1368', '1598'], kwRange: [74, 103], classe: 'Berlina' },
      { nome: 'Tucson', anni: [2015, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1598', '1998'], kwRange: [97, 140], classe: 'SUV' },
      { nome: 'Kona', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica', 'Ibrida'], cilindrate: ['998', '1598'], kwRange: [74, 145], classe: 'SUV' },
      { nome: 'Bayon', anni: [2021, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['998', '1199'], kwRange: [62, 74], classe: 'SUV' },
      { nome: 'Santa Fe', anni: [2006, 2026], carburanti: ['Diesel', 'Benzina', 'Ibrida'], cilindrate: ['1998', '2199', '2497'], kwRange: [110, 170], classe: 'SUV' },
      { nome: 'ix20', anni: [2010, 2019], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1396', '1582', '1598'], kwRange: [66, 92], classe: 'Monovolume' },
      { nome: 'ix35', anni: [2010, 2015], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1591', '1685', '1995'], kwRange: [99, 135], classe: 'SUV' },
      { nome: 'IONIQ 5', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [125, 239], classe: 'SUV' },
      { nome: 'IONIQ 6', anni: [2023, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [111, 239], classe: 'Berlina' },
      { nome: 'H350', anni: [2015, 2020], carburanti: ['Diesel'], cilindrate: ['2497'], kwRange: [110, 125], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Kia',
    modelli: [
      { nome: 'Picanto', anni: [2011, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['998', '1248'], kwRange: [49, 62], classe: 'Utilitaria' },
      { nome: 'Rio', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1248', '1396'], kwRange: [55, 74], classe: 'Utilitaria' },
      { nome: 'Ceed', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1368', '1598'], kwRange: [74, 103], classe: 'Berlina' },
      { nome: 'Sportage', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1598', '1998'], kwRange: [97, 145], classe: 'SUV' },
      { nome: 'Niro', anni: [2016, 2026], carburanti: ['Ibrida', 'Elettrica'], cilindrate: ['1580'], kwRange: [77, 150], classe: 'SUV' },
      { nome: 'Stonic', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1396', '1598'], kwRange: [62, 88], classe: 'SUV' },
      { nome: 'XCeed', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['998', '1368', '1598'], kwRange: [74, 141], classe: 'SUV' },
      { nome: 'Sorento', anni: [2009, 2026], carburanti: ['Diesel', 'Benzina', 'Ibrida'], cilindrate: ['2199', '2497'], kwRange: [147, 169], classe: 'SUV' },
      { nome: 'Venga', anni: [2010, 2019], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1396', '1582', '1598'], kwRange: [66, 92], classe: 'Monovolume' },
      { nome: 'EV6', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [125, 239], classe: 'SUV' },
      { nome: 'EV9', anni: [2024, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [150, 283], classe: 'SUV' },
      { nome: 'ProCeed', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['998', '1368', '1598'], kwRange: [74, 150], classe: 'Berlina' },
    ],
  },
  {
    marca: 'Nissan',
    modelli: [
      { nome: 'Micra', anni: [2010, 2026], carburanti: ['Benzina'], cilindrate: ['898', '999'], kwRange: [52, 74], classe: 'Utilitaria' },
      { nome: 'Qashqai', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1197', '1332', '1461', '1598'], kwRange: [85, 116], classe: 'SUV' },
      { nome: 'Juke', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['999', '1197', '1461'], kwRange: [69, 86], classe: 'SUV' },
      { nome: 'Leaf', anni: [2011, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [80, 160], classe: 'Berlina' },
      { nome: 'X-Trail', anni: [2007, 2026], carburanti: ['Diesel', 'Benzina', 'Ibrida'], cilindrate: ['1598', '1997', '1498'], kwRange: [96, 150], classe: 'SUV' },
      { nome: 'Note', anni: [2006, 2020], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1198', '1461'], kwRange: [59, 66], classe: 'Monovolume' },
      { nome: 'Navara', anni: [2005, 2026], carburanti: ['Diesel'], cilindrate: ['2298', '2488'], kwRange: [120, 140], classe: 'Commerciale' },
      { nome: 'NV200', anni: [2010, 2024], carburanti: ['Diesel', 'Benzina', 'Elettrica'], cilindrate: ['1461', '1598'], kwRange: [66, 80], classe: 'Commerciale' },
      { nome: 'NV300', anni: [2016, 2024], carburanti: ['Diesel'], cilindrate: ['1598', '1997'], kwRange: [88, 125], classe: 'Commerciale' },
      { nome: 'Ariya', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [160, 225], classe: 'SUV' },
    ],
  },
  {
    marca: 'Alfa Romeo',
    modelli: [
      { nome: 'Giulietta', anni: [2010, 2020], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1368', '1598', '1742', '1956'], kwRange: [77, 125], classe: 'Berlina' },
      { nome: 'Giulia', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1995', '2143'], kwRange: [118, 206], classe: 'Berlina' },
      { nome: 'Stelvio', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1995', '2143'], kwRange: [118, 206], classe: 'SUV' },
      { nome: 'Tonale', anni: [2022, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1332', '1598'], kwRange: [96, 202], classe: 'SUV' },
      { nome: 'MiTo', anni: [2008, 2018], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['875', '1248', '1368', '1598'], kwRange: [51, 125], classe: 'Utilitaria' },
      { nome: '159', anni: [2005, 2011], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1742', '1910', '1956', '2387'], kwRange: [110, 191], classe: 'Berlina' },
      { nome: 'Junior', anni: [2024, 2026], carburanti: ['Benzina', 'Ibrida', 'Elettrica'], cilindrate: ['1199', '0'], kwRange: [74, 115], classe: 'SUV' },
    ],
  },
  {
    marca: 'Dacia',
    modelli: [
      { nome: 'Sandero', anni: [2008, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['999', '1598'], kwRange: [49, 67], classe: 'Utilitaria' },
      { nome: 'Duster', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['1332', '1461', '1598'], kwRange: [74, 110], classe: 'SUV' },
      { nome: 'Spring', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [33, 48], classe: 'Utilitaria' },
      { nome: 'Jogger', anni: [2022, 2026], carburanti: ['Benzina', 'GPL', 'Ibrida'], cilindrate: ['999', '1598'], kwRange: [74, 103], classe: 'Monovolume' },
      { nome: 'Logan', anni: [2005, 2022], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['999', '1461', '1598'], kwRange: [55, 67], classe: 'Berlina' },
      { nome: 'Sandero Stepway', anni: [2009, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['999', '1598'], kwRange: [66, 67], classe: 'SUV' },
      { nome: 'Dokker', anni: [2013, 2022], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['1197', '1461', '1598'], kwRange: [55, 85], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'SEAT',
    modelli: [
      { nome: 'Ibiza', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498'], kwRange: [59, 110], classe: 'Utilitaria' },
      { nome: 'Leon', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel', 'Metano'], cilindrate: ['999', '1498', '1968'], kwRange: [66, 140], classe: 'Berlina' },
      { nome: 'Arona', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498'], kwRange: [70, 110], classe: 'SUV' },
      { nome: 'Ateca', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'SUV' },
      { nome: 'Tarraco', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 140], classe: 'SUV' },
      { nome: 'Mii', anni: [2012, 2021], carburanti: ['Benzina', 'Metano', 'Elettrica'], cilindrate: ['999', '0'], kwRange: [44, 61], classe: 'Utilitaria' },
      { nome: 'Alhambra', anni: [2010, 2020], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1395', '1968'], kwRange: [110, 162], classe: 'Monovolume' },
    ],
  },
  {
    marca: 'Škoda',
    modelli: [
      { nome: 'Fabia', anni: [2007, 2026], carburanti: ['Benzina'], cilindrate: ['999', '1498'], kwRange: [55, 110], classe: 'Utilitaria' },
      { nome: 'Octavia', anni: [2004, 2026], carburanti: ['Benzina', 'Diesel', 'Metano'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'Berlina' },
      { nome: 'Kamiq', anni: [2019, 2026], carburanti: ['Benzina'], cilindrate: ['999', '1498'], kwRange: [81, 110], classe: 'SUV' },
      { nome: 'Karoq', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498', '1968'], kwRange: [81, 140], classe: 'SUV' },
      { nome: 'Kodiaq', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 140], classe: 'SUV' },
      { nome: 'Scala', anni: [2019, 2026], carburanti: ['Benzina', 'Metano'], cilindrate: ['999', '1498'], kwRange: [70, 110], classe: 'Berlina' },
      { nome: 'Superb', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 200], classe: 'Berlina' },
      { nome: 'Citigo', anni: [2012, 2020], carburanti: ['Benzina', 'Metano', 'Elettrica'], cilindrate: ['999', '0'], kwRange: [44, 61], classe: 'Utilitaria' },
      { nome: 'Rapid', anni: [2012, 2019], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1498'], kwRange: [70, 81], classe: 'Berlina' },
      { nome: 'Enyaq', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [132, 220], classe: 'SUV' },
    ],
  },
  {
    marca: 'Suzuki',
    modelli: [
      { nome: 'Swift', anni: [2005, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1197', '1242'], kwRange: [61, 82], classe: 'Utilitaria' },
      { nome: 'Vitara', anni: [2015, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1373', '1462'], kwRange: [82, 95], classe: 'SUV' },
      { nome: 'Ignis', anni: [2016, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1197', '1242'], kwRange: [61, 66], classe: 'Utilitaria' },
      { nome: 'S-Cross', anni: [2013, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1373', '1598'], kwRange: [82, 95], classe: 'SUV' },
      { nome: 'Jimny', anni: [2005, 2026], carburanti: ['Benzina'], cilindrate: ['1328', '1462'], kwRange: [62, 75], classe: 'SUV' },
      { nome: 'Baleno', anni: [2016, 2024], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1197', '1242'], kwRange: [61, 82], classe: 'Utilitaria' },
      { nome: 'Splash', anni: [2008, 2015], carburanti: ['Benzina', 'Diesel'], cilindrate: ['996', '1248'], kwRange: [51, 55], classe: 'Utilitaria' },
      { nome: 'SX4 S-Cross', anni: [2006, 2013], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1490', '1586', '1910'], kwRange: [79, 99], classe: 'SUV' },
      { nome: 'Across', anni: [2020, 2026], carburanti: ['Ibrida'], cilindrate: ['2487'], kwRange: [136, 225], classe: 'SUV' },
      { nome: 'Swace', anni: [2020, 2026], carburanti: ['Ibrida'], cilindrate: ['1798'], kwRange: [90, 90], classe: 'Berlina' },
    ],
  },
  {
    marca: 'Lancia',
    modelli: [
      { nome: 'Ypsilon', anni: [2003, 2026], carburanti: ['Benzina', 'GPL', 'Metano', 'Ibrida', 'Elettrica'], cilindrate: ['875', '1242', '1248', '0'], kwRange: [51, 115], classe: 'Utilitaria' },
      { nome: 'Delta', anni: [2008, 2014], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1368', '1598', '1742', '1956'], kwRange: [88, 140], classe: 'Berlina' },
      { nome: 'Musa', anni: [2004, 2012], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1248', '1368'], kwRange: [51, 77], classe: 'Monovolume' },
    ],
  },
  {
    marca: 'Jeep',
    modelli: [
      { nome: 'Renegade', anni: [2014, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['999', '1332', '1598', '1995'], kwRange: [88, 147], classe: 'SUV' },
      { nome: 'Compass', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1332', '1598', '1995'], kwRange: [96, 177], classe: 'SUV' },
      { nome: 'Avenger', anni: [2023, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [74, 115], classe: 'SUV' },
      { nome: 'Wrangler', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['2143', '2776', '3604'], kwRange: [147, 209], classe: 'SUV' },
      { nome: 'Cherokee', anni: [2013, 2023], carburanti: ['Benzina', 'Diesel'], cilindrate: ['2143', '2184', '3239'], kwRange: [140, 200], classe: 'SUV' },
      { nome: 'Grand Cherokee', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2987', '3604'], kwRange: [184, 280], classe: 'SUV' },
    ],
  },
  {
    marca: 'Volvo',
    modelli: [
      { nome: 'XC40', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida', 'Elettrica'], cilindrate: ['1477', '1969'], kwRange: [120, 170], classe: 'SUV' },
      { nome: 'XC60', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1969'], kwRange: [145, 235], classe: 'SUV' },
      { nome: 'XC90', anni: [2015, 2026], carburanti: ['Diesel', 'Ibrida'], cilindrate: ['1969'], kwRange: [173, 288], classe: 'SUV' },
      { nome: 'V40', anni: [2012, 2019], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1969'], kwRange: [88, 140], classe: 'Berlina' },
      { nome: 'V60', anni: [2018, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1969'], kwRange: [120, 250], classe: 'Berlina' },
      { nome: 'S60', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1969'], kwRange: [120, 250], classe: 'Berlina' },
      { nome: 'V90', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1969'], kwRange: [140, 288], classe: 'Berlina' },
      { nome: 'EX30', anni: [2024, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [200, 315], classe: 'SUV' },
      { nome: 'C40', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [170, 300], classe: 'SUV' },
    ],
  },
  {
    marca: 'Land Rover',
    modelli: [
      { nome: 'Evoque', anni: [2011, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1999', '2179'], kwRange: [110, 183], classe: 'SUV' },
      { nome: 'Discovery Sport', anni: [2014, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1999', '2179'], kwRange: [110, 183], classe: 'SUV' },
      { nome: 'Defender', anni: [2020, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1997', '2996'], kwRange: [147, 294], classe: 'SUV' },
      { nome: 'Discovery', anni: [2004, 2026], carburanti: ['Diesel', 'Benzina'], cilindrate: ['2179', '2993', '2996'], kwRange: [150, 265], classe: 'SUV' },
      { nome: 'Velar', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1999', '2996'], kwRange: [132, 294], classe: 'SUV' },
    ],
  },
  {
    marca: 'Smart',
    modelli: [
      { nome: 'Fortwo', anni: [2007, 2024], carburanti: ['Benzina', 'Elettrica'], cilindrate: ['898', '999'], kwRange: [45, 66], classe: 'Utilitaria' },
      { nome: 'Forfour', anni: [2014, 2024], carburanti: ['Benzina', 'Elettrica'], cilindrate: ['898', '999'], kwRange: [45, 66], classe: 'Utilitaria' },
      { nome: '#1', anni: [2023, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [200, 315], classe: 'SUV' },
      { nome: '#3', anni: [2024, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [200, 315], classe: 'SUV' },
    ],
  },
  {
    marca: 'Mini',
    modelli: [
      { nome: 'Cooper', anni: [2006, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1499', '1998'], kwRange: [75, 141], classe: 'Utilitaria' },
      { nome: 'Countryman', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida', 'Elettrica'], cilindrate: ['1499', '1998'], kwRange: [75, 170], classe: 'SUV' },
      { nome: 'Clubman', anni: [2015, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1499', '1998'], kwRange: [75, 141], classe: 'Berlina' },
      { nome: 'Cabrio', anni: [2009, 2026], carburanti: ['Benzina'], cilindrate: ['1499', '1998'], kwRange: [75, 141], classe: 'Cabrio' },
      { nome: 'Paceman', anni: [2013, 2016], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1598', '1998'], kwRange: [82, 135], classe: 'Coupé' },
    ],
  },
  {
    marca: 'Mazda',
    modelli: [
      { nome: 'Mazda2', anni: [2007, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1496', '1498'], kwRange: [55, 85], classe: 'Utilitaria' },
      { nome: 'Mazda3', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1496', '1998'], kwRange: [88, 132], classe: 'Berlina' },
      { nome: 'CX-5', anni: [2012, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1998', '2488'], kwRange: [121, 143], classe: 'SUV' },
      { nome: 'CX-30', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1798', '1998'], kwRange: [85, 132], classe: 'SUV' },
      { nome: 'MX-5', anni: [2005, 2026], carburanti: ['Benzina'], cilindrate: ['1496', '1998'], kwRange: [96, 135], classe: 'Cabrio' },
      { nome: 'Mazda6', anni: [2008, 2023], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1998', '2191', '2488'], kwRange: [107, 143], classe: 'Berlina' },
      { nome: 'CX-3', anni: [2015, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1496', '1798'], kwRange: [77, 110], classe: 'SUV' },
      { nome: 'CX-60', anni: [2022, 2026], carburanti: ['Diesel', 'Ibrida'], cilindrate: ['2488', '3283'], kwRange: [147, 241], classe: 'SUV' },
    ],
  },
  {
    marca: 'Mitsubishi',
    modelli: [
      { nome: 'Space Star', anni: [2013, 2026], carburanti: ['Benzina'], cilindrate: ['999', '1193'], kwRange: [52, 59], classe: 'Utilitaria' },
      { nome: 'ASX', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1590', '1798'], kwRange: [85, 110], classe: 'SUV' },
      { nome: 'Eclipse Cross', anni: [2017, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1499', '2360'], kwRange: [110, 138], classe: 'SUV' },
      { nome: 'Outlander', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1998', '2360'], kwRange: [110, 165], classe: 'SUV' },
      { nome: 'L200', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2268', '2442'], kwRange: [100, 133], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Subaru',
    modelli: [
      { nome: 'Impreza', anni: [2007, 2026], carburanti: ['Benzina'], cilindrate: ['1600', '2000'], kwRange: [84, 115], classe: 'Berlina' },
      { nome: 'XV', anni: [2012, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1600', '2000'], kwRange: [84, 115], classe: 'SUV' },
      { nome: 'Forester', anni: [2008, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2000', '2498'], kwRange: [110, 170], classe: 'SUV' },
      { nome: 'Outback', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['2498'], kwRange: [129, 175], classe: 'Berlina' },
      { nome: 'Solterra', anni: [2023, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [150, 160], classe: 'SUV' },
    ],
  },
  {
    marca: 'Honda',
    modelli: [
      { nome: 'Jazz', anni: [2008, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1318', '1498'], kwRange: [75, 80], classe: 'Utilitaria' },
      { nome: 'Civic', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1498', '1799', '1993'], kwRange: [74, 143], classe: 'Berlina' },
      { nome: 'HR-V', anni: [2015, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1498', '1799'], kwRange: [96, 131], classe: 'SUV' },
      { nome: 'CR-V', anni: [2007, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1597', '1993', '2354'], kwRange: [103, 145], classe: 'SUV' },
      { nome: 'e:Ny1', anni: [2023, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [150, 150], classe: 'SUV' },
      { nome: 'e', anni: [2020, 2024], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [100, 100], classe: 'Utilitaria' },
      { nome: 'ZR-V', anni: [2023, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['1993'], kwRange: [122, 135], classe: 'SUV' },
    ],
  },
  {
    marca: 'Iveco',
    modelli: [
      { nome: 'Daily', anni: [2006, 2026], carburanti: ['Diesel'], cilindrate: ['2287', '2998'], kwRange: [85, 155], classe: 'Commerciale' },
      { nome: 'Eurocargo', anni: [2008, 2026], carburanti: ['Diesel'], cilindrate: ['3920', '6728'], kwRange: [118, 235], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Piaggio',
    modelli: [
      { nome: 'Porter', anni: [2009, 2026], carburanti: ['Benzina', 'GPL', 'Elettrica'], cilindrate: ['1299', '0'], kwRange: [37, 48], classe: 'Commerciale' },
      { nome: 'Ape', anni: [2005, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['218', '422'], kwRange: [4, 7], classe: 'Commerciale' },
    ],
  },
  {
    marca: 'Cupra',
    modelli: [
      { nome: 'Born', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [110, 170], classe: 'Berlina' },
      { nome: 'Formentor', anni: [2020, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1498', '1968'], kwRange: [110, 228], classe: 'SUV' },
      { nome: 'Leon', anni: [2020, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1498', '1968'], kwRange: [110, 195], classe: 'Berlina' },
      { nome: 'Ateca', anni: [2020, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1968'], kwRange: [110, 221], classe: 'SUV' },
      { nome: 'Tavascan', anni: [2024, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [210, 250], classe: 'SUV' },
    ],
  },
  {
    marca: 'Abarth',
    modelli: [
      { nome: '595', anni: [2012, 2024], carburanti: ['Benzina'], cilindrate: ['1368'], kwRange: [107, 132], classe: 'Sportiva' },
      { nome: '695', anni: [2013, 2024], carburanti: ['Benzina'], cilindrate: ['1368'], kwRange: [132, 147], classe: 'Sportiva' },
      { nome: '500e', anni: [2023, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [113, 113], classe: 'Sportiva' },
      { nome: '124 Spider', anni: [2016, 2020], carburanti: ['Benzina'], cilindrate: ['1368'], kwRange: [125, 125], classe: 'Cabrio' },
      { nome: 'Punto', anni: [2007, 2015], carburanti: ['Benzina'], cilindrate: ['1368'], kwRange: [120, 132], classe: 'Sportiva' },
    ],
  },
  {
    marca: 'DS',
    modelli: [
      { nome: 'DS 3 Crossback', anni: [2019, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1199', '1499'], kwRange: [74, 114], classe: 'SUV' },
      { nome: 'DS 4', anni: [2021, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1598'], kwRange: [96, 165], classe: 'Berlina' },
      { nome: 'DS 7', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['1199', '1499', '1598'], kwRange: [96, 225], classe: 'SUV' },
      { nome: 'DS 3', anni: [2010, 2019], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1199', '1560', '1598'], kwRange: [50, 155], classe: 'Utilitaria' },
      { nome: 'DS 9', anni: [2022, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['1598'], kwRange: [165, 265], classe: 'Berlina' },
    ],
  },
  {
    marca: 'Lexus',
    modelli: [
      { nome: 'UX', anni: [2018, 2026], carburanti: ['Ibrida', 'Elettrica'], cilindrate: ['1987'], kwRange: [135, 150], classe: 'SUV' },
      { nome: 'NX', anni: [2014, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['2487'], kwRange: [155, 185], classe: 'SUV' },
      { nome: 'RX', anni: [2015, 2026], carburanti: ['Ibrida'], cilindrate: ['2487', '3456'], kwRange: [183, 245], classe: 'SUV' },
      { nome: 'CT', anni: [2011, 2022], carburanti: ['Ibrida'], cilindrate: ['1798'], kwRange: [100, 100], classe: 'Berlina' },
      { nome: 'IS', anni: [2005, 2026], carburanti: ['Ibrida', 'Benzina'], cilindrate: ['2487', '2499'], kwRange: [153, 184], classe: 'Berlina' },
      { nome: 'LBX', anni: [2024, 2026], carburanti: ['Ibrida'], cilindrate: ['1490'], kwRange: [100, 100], classe: 'SUV' },
    ],
  },
  {
    marca: 'Tesla',
    modelli: [
      { nome: 'Model 3', anni: [2019, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [208, 366], classe: 'Berlina' },
      { nome: 'Model Y', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [220, 378], classe: 'SUV' },
      { nome: 'Model S', anni: [2013, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [320, 560], classe: 'Berlina' },
      { nome: 'Model X', anni: [2016, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [320, 560], classe: 'SUV' },
    ],
  },
  {
    marca: 'Porsche',
    modelli: [
      { nome: 'Cayenne', anni: [2010, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2995', '3996', '4806'], kwRange: [183, 404], classe: 'SUV' },
      { nome: 'Macan', anni: [2014, 2026], carburanti: ['Benzina', 'Diesel', 'Elettrica'], cilindrate: ['1984', '2995'], kwRange: [185, 280], classe: 'SUV' },
      { nome: '911', anni: [2005, 2026], carburanti: ['Benzina'], cilindrate: ['2981', '3745', '3996'], kwRange: [272, 478], classe: 'Sportiva' },
      { nome: 'Panamera', anni: [2009, 2026], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2894', '2995', '3996'], kwRange: [206, 404], classe: 'Berlina' },
      { nome: 'Taycan', anni: [2020, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [240, 560], classe: 'Berlina' },
      { nome: '718 Boxster', anni: [2016, 2026], carburanti: ['Benzina'], cilindrate: ['1988', '2497', '3995'], kwRange: [220, 309], classe: 'Cabrio' },
    ],
  },
  {
    marca: 'Maserati',
    modelli: [
      { nome: 'Ghibli', anni: [2013, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['2979', '2987'], kwRange: [202, 316], classe: 'Berlina' },
      { nome: 'Levante', anni: [2016, 2024], carburanti: ['Benzina', 'Diesel', 'Ibrida'], cilindrate: ['2979', '2987'], kwRange: [202, 433], classe: 'SUV' },
      { nome: 'Grecale', anni: [2022, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1995', '2992'], kwRange: [221, 390], classe: 'SUV' },
      { nome: 'GranTurismo', anni: [2007, 2026], carburanti: ['Benzina', 'Elettrica'], cilindrate: ['2992', '4244', '4691'], kwRange: [316, 490], classe: 'Coupé' },
      { nome: 'Quattroporte', anni: [2005, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['2979', '3799'], kwRange: [275, 390], classe: 'Berlina' },
    ],
  },
  {
    marca: 'MG',
    modelli: [
      { nome: 'ZS', anni: [2020, 2026], carburanti: ['Benzina', 'Elettrica'], cilindrate: ['1498', '0'], kwRange: [78, 130], classe: 'SUV' },
      { nome: 'MG4', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [125, 180], classe: 'Berlina' },
      { nome: 'HS', anni: [2020, 2026], carburanti: ['Benzina', 'Ibrida'], cilindrate: ['1490'], kwRange: [119, 189], classe: 'SUV' },
      { nome: 'Marvel R', anni: [2021, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [132, 212], classe: 'SUV' },
      { nome: 'MG5', anni: [2022, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [115, 115], classe: 'Berlina' },
    ],
  },
  {
    marca: 'DR',
    modelli: [
      { nome: 'DR 5.0', anni: [2018, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['1498'], kwRange: [85, 108], classe: 'SUV' },
      { nome: 'DR 4.0', anni: [2020, 2026], carburanti: ['Benzina'], cilindrate: ['1498'], kwRange: [85, 108], classe: 'SUV' },
      { nome: 'DR 6.0', anni: [2020, 2026], carburanti: ['Benzina', 'GPL'], cilindrate: ['1498'], kwRange: [108, 130], classe: 'SUV' },
      { nome: 'DR 3.0', anni: [2019, 2026], carburanti: ['Benzina'], cilindrate: ['1498'], kwRange: [80, 85], classe: 'SUV' },
      { nome: 'DR 1.0', anni: [2020, 2026], carburanti: ['Benzina'], cilindrate: ['1199'], kwRange: [61, 68], classe: 'Utilitaria' },
    ],
  },
  {
    marca: 'Jaguar',
    modelli: [
      { nome: 'E-Pace', anni: [2017, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1999', '2497'], kwRange: [150, 221], classe: 'SUV' },
      { nome: 'F-Pace', anni: [2016, 2026], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1999', '2996'], kwRange: [163, 294], classe: 'SUV' },
      { nome: 'I-Pace', anni: [2018, 2026], carburanti: ['Elettrica'], cilindrate: ['0'], kwRange: [294, 294], classe: 'SUV' },
      { nome: 'XE', anni: [2015, 2023], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1999', '2497'], kwRange: [132, 221], classe: 'Berlina' },
      { nome: 'XF', anni: [2008, 2023], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1999', '2497', '2996'], kwRange: [163, 294], classe: 'Berlina' },
      { nome: 'F-Type', anni: [2013, 2024], carburanti: ['Benzina'], cilindrate: ['1997', '2995', '5000'], kwRange: [221, 423], classe: 'Sportiva' },
    ],
  },
  {
    marca: 'Ssangyong',
    modelli: [
      { nome: 'Tivoli', anni: [2015, 2024], carburanti: ['Benzina', 'Diesel', 'GPL'], cilindrate: ['1498', '1597'], kwRange: [94, 120], classe: 'SUV' },
      { nome: 'Korando', anni: [2011, 2024], carburanti: ['Benzina', 'Diesel'], cilindrate: ['1498', '1597'], kwRange: [120, 136], classe: 'SUV' },
      { nome: 'Rexton', anni: [2017, 2024], carburanti: ['Diesel'], cilindrate: ['2157'], kwRange: [133, 149], classe: 'SUV' },
    ],
  },
];

// ============================================================
// MAPPATURA TARGHE ITALIANE → ANNO IMMATRICOLAZIONE
// Le targhe italiane dal 1994 seguono il formato AA 000 AA
// La prima coppia di lettere avanza progressivamente
// ============================================================

const TARGA_ANNO_MAP: [string, number][] = [
  ['AA', 1994], ['AB', 1994], ['AC', 1995], ['AD', 1995],
  ['AE', 1996], ['AF', 1996], ['AG', 1996], ['AH', 1997],
  ['AJ', 1997], ['AK', 1997], ['AL', 1998], ['AM', 1998],
  ['AN', 1998], ['AP', 1999], ['AR', 1999], ['AS', 1999],
  ['AT', 2000], ['AV', 2000], ['AW', 2000], ['AX', 2001],
  ['AY', 2001], ['AZ', 2001],
  ['BA', 2001], ['BB', 2002], ['BC', 2002], ['BD', 2002],
  ['BE', 2003], ['BF', 2003], ['BG', 2003], ['BH', 2004],
  ['BJ', 2004], ['BK', 2004], ['BL', 2005], ['BM', 2005],
  ['BN', 2005], ['BP', 2006], ['BR', 2006], ['BS', 2006],
  ['BT', 2006], ['BV', 2007], ['BW', 2007], ['BX', 2007],
  ['BY', 2007], ['BZ', 2008],
  ['CA', 2008], ['CB', 2008], ['CC', 2008], ['CD', 2009],
  ['CE', 2009], ['CF', 2009], ['CG', 2009], ['CH', 2010],
  ['CJ', 2010], ['CK', 2010], ['CL', 2010], ['CM', 2011],
  ['CN', 2011], ['CP', 2011], ['CR', 2011], ['CS', 2012],
  ['CT', 2012], ['CV', 2012], ['CW', 2012], ['CX', 2013],
  ['CY', 2013], ['CZ', 2013],
  ['DA', 2013], ['DB', 2014], ['DC', 2014], ['DD', 2014],
  ['DE', 2014], ['DF', 2015], ['DG', 2015], ['DH', 2015],
  ['DJ', 2015], ['DK', 2016], ['DL', 2016], ['DM', 2016],
  ['DN', 2016], ['DP', 2017], ['DR', 2017], ['DS', 2017],
  ['DT', 2017], ['DV', 2018], ['DW', 2018], ['DX', 2018],
  ['DY', 2018], ['DZ', 2019],
  ['EA', 2019], ['EB', 2019], ['EC', 2019], ['ED', 2020],
  ['EE', 2020], ['EF', 2020], ['EG', 2020], ['EH', 2021],
  ['EJ', 2021], ['EK', 2021], ['EL', 2021], ['EM', 2022],
  ['EN', 2022], ['EP', 2022], ['ER', 2022], ['ES', 2023],
  ['ET', 2023], ['EV', 2023], ['EW', 2023], ['EX', 2024],
  ['EY', 2024], ['EZ', 2024],
  ['FA', 2024], ['FB', 2025], ['FC', 2025], ['FD', 2025],
  ['FE', 2025], ['FF', 2026], ['FG', 2026], ['FH', 2026],
  ['FJ', 2026], ['FK', 2027], ['FL', 2027], ['FM', 2027],
];

function annoFromTarga(targa: string): number {
  const prefix = targa.substring(0, 2).toUpperCase();
  // Search from end to find closest match
  for (let i = TARGA_ANNO_MAP.length - 1; i >= 0; i--) {
    if (TARGA_ANNO_MAP[i][0] <= prefix) {
      return TARGA_ANNO_MAP[i][1];
    }
  }
  return 2020; // fallback
}

// ============================================================
// GENERATORE DATI VEICOLO REALISTICI
// ============================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash);
}

export function generaDatiVeicolo(targa: string): DatiVeicolo {
  const t = targa.toUpperCase().replace(/\s/g, '');
  const hash = hashString(t);
  const anno = annoFromTarga(t);

  // Pick a brand based on hash — weighted towards popular Italian market brands
  const allBrands = DB_AUTO.flatMap(b =>
    b.marca === 'Fiat' || b.marca === 'Volkswagen' || b.marca === 'Ford' || b.marca === 'Toyota'
      ? [b, b] // Double weight for most popular
      : [b]
  );
  const brand = allBrands[hash % allBrands.length];

  // Pick a model that was available in the anno
  const availableModels = brand.modelli.filter(m => anno >= m.anni[0] && anno <= m.anni[1]);
  const model = availableModels.length > 0
    ? availableModels[(hash >> 3) % availableModels.length]
    : brand.modelli[(hash >> 3) % brand.modelli.length];

  // Pick fuel type
  const carburante = model.carburanti[(hash >> 5) % model.carburanti.length];

  // Pick cilindrata
  const cilindrata = model.cilindrate[(hash >> 7) % model.cilindrate.length];

  // Potenza
  const kwRange = model.kwRange[1] - model.kwRange[0];
  const potenzaKw = model.kwRange[0] + ((hash >> 9) % (kwRange + 1));
  const potenzaCv = Math.round(potenzaKw * 1.36);

  // Euro class based on year
  let euroClasse = 'Euro 6';
  if (anno < 2015) euroClasse = 'Euro 5';
  if (anno < 2011) euroClasse = 'Euro 4';
  if (anno < 2006) euroClasse = 'Euro 3';

  // Colori comuni
  const colori = ['Grigio', 'Bianco', 'Nero', 'Blu', 'Rosso', 'Argento', 'Antracite', 'Verde', 'Marrone'];
  const colore = colori[(hash >> 11) % colori.length];

  // Posti
  const posti = model.classe === 'Commerciale' ? 3 : model.classe === 'Monovolume' ? 7 : 5;

  // Peso
  const pesoBase = model.classe === 'Utilitaria' ? 1000 : model.classe === 'Berlina' ? 1250 :
    model.classe === 'SUV' ? 1450 : model.classe === 'Commerciale' ? 1800 : 1300;
  const peso = pesoBase + ((hash >> 13) % 200);

  // Neopatentati (< 55 kW/t o potenza bassa)
  const neopatentati = potenzaKw <= 70 && (potenzaKw / (peso / 1000)) <= 55;

  return {
    targa: t,
    marca: brand.marca,
    modello: model.nome,
    anno,
    carburante,
    cilindrata: cilindrata + ' cc',
    potenzaKw,
    potenzaCv,
    classe: model.classe,
    colore,
    euroClasse,
    posti,
    peso,
    neopatentati,
    daDatabase: false,
  };
}

// ============================================================
// API ESTERNA — Lookup reale via Vercel Serverless Function
// ============================================================

/**
 * Cerca i dati REALI del veicolo tramite /api/targa-lookup.
 * L'API proxy chiama OpenAPI.com o Targa.co.it (se chiave configurata).
 * Se nessuna API è configurata o la chiamata fallisce, ritorna null.
 */
export async function lookupTargaEsterna(targa: string): Promise<DatiVeicolo | null> {
  try {
    const resp = await fetch(`/api/targa-lookup?targa=${encodeURIComponent(targa)}`);
    if (!resp.ok) return null;

    const json = await resp.json();

    // Se nessuna API configurata e nessun dato trovato
    if (json.source === 'none') return null;

    // Costruisci dati RCA se disponibili (da RapidAPI)
    const rca: DatiRCA | undefined = json.compagniaAssicurativa ? {
      tipoVeicolo: json.tipoVeicolo,
      descrizioneTipoVeicolo: json.descrizioneTipoVeicolo,
      compagniaAssicurativa: json.compagniaAssicurativa,
      numeroPolizza: json.numeroPolizza,
      dataScadenzaPolizza: json.dataScadenzaPolizza,
      assicurazionePresente: json.assicurazionePresente,
      assicurazioneSospesa: json.assicurazioneSospesa,
      theftstatus: json.theftstatus,
    } : undefined;

    // Se abbiamo dati tecnici (da OpenAPI), usali
    if (json.marca) {
      return {
        targa: json.targa,
        marca: json.marca,
        modello: json.modello,
        anno: json.anno || 0,
        carburante: json.carburante || '',
        cilindrata: json.cilindrata ? json.cilindrata + (json.cilindrata.includes('cc') ? '' : ' cc') : undefined,
        potenzaKw: json.potenzaKw || undefined,
        potenzaCv: json.potenzaCv || undefined,
        classe: undefined,
        daDatabase: false,
        rca,
      };
    }

    // Se abbiamo solo dati RCA (targa verificata ma senza dati tecnici),
    // generiamo i dati tecnici localmente ma alleghiamo i dati RCA
    if (rca) {
      const generati = generaDatiVeicolo(targa);
      generati.rca = rca;
      return generati;
    }

    return null;
  } catch {
    return null;
  }
}
