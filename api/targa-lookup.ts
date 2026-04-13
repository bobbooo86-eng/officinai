// Vercel Serverless Function: /api/targa-lookup?targa=XX000XX
// Proxy per evitare problemi CORS con le API esterne
// Supporta: Evita-Multe.it, OpenAPI.com, RapidAPI (RCA), fallback none

export default async function handler(req: any, res: any) {
  const targa = (req.query.targa || '').toString().toUpperCase().replace(/\s/g, '');

  if (!targa || targa.length < 5) {
    return res.status(400).json({ error: 'Targa non valida' });
  }

  // 1. Try Evita-Multe.it (if API key configured) — DATI TECNICI REALI
  const evitaMulteKey = process.env.EVITAMULTE_KEY;
  if (evitaMulteKey) {
    try {
      const resp = await fetch(`https://api.evita-multe.it/v1/veicolo/${targa}`, {
        headers: { Authorization: `Bearer ${evitaMulteKey}` },
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && (json.marca || json.brand || json.make)) {
          const d = json;
          return res.status(200).json({
            source: 'evitamulte',
            targa: targa,
            marca: d.marca || d.brand || d.make || '',
            modello: d.modello || d.model || '',
            descrizione: d.descrizione || d.description || `${d.marca || d.brand || ''} ${d.modello || d.model || ''}`.trim(),
            versione: d.versione || d.version || d.allestimento || '',
            anno: parseInt(d.anno || d.year || d.annoImmatricolazione || '0') || 0,
            carburante: tradCarburante(d.carburante || d.fuel || d.alimentazione || ''),
            cilindrata: d.cilindrata || d.displacement || d.cc || '',
            potenzaKw: parseInt(d.potenzaKw || d.kw || '0') || 0,
            potenzaCv: parseInt(d.potenzaCv || d.cv || d.hp || '0') || 0,
            potenzaFiscale: parseInt(d.potenzaFiscale || '0') || 0,
            porte: d.porte || d.doors || '',
            telaio: d.telaio || d.vin || d.chassis || '',
            trazione: d.trazione || d.drive || '',
            codiceMotore: d.codiceMotore || d.engineCode || '',
            massa: d.massa || d.weight || '',
            euroClasse: d.euroClasse || d.euro || '',
            colore: d.colore || d.color || '',
          });
        }
      }
    } catch (e) {
      console.error('Evita-Multe error:', e);
    }
  }

  // 2. Try OpenAPI.com (if API key configured)
  const openApiKey = process.env.OPENAPI_KEY;
  if (openApiKey) {
    try {
      const resp = await fetch(`https://automotive.openapi.com/IT-car/${targa}`, {
        headers: { Authorization: `Bearer ${openApiKey}` },
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          return res.status(200).json({
            source: 'openapi',
            targa: json.data.LicensePlate,
            marca: json.data.CarMake,
            modello: json.data.CarModel || json.data.ModelDescription,
            descrizione: json.data.Description,
            versione: json.data.Version,
            anno: parseInt(json.data.RegistrationYear) || 0,
            carburante: tradCarburante(json.data.FuelType),
            cilindrata: json.data.EngineSize || '',
            potenzaKw: json.data.PowerKW || 0,
            potenzaCv: json.data.PowerCV || 0,
            potenzaFiscale: json.data.PowerFiscal || 0,
            porte: json.data.NumberOfDoors || '',
            telaio: json.data.Vin || '',
          });
        }
      }
    } catch (e) {
      console.error('OpenAPI error:', e);
    }
  }

  // 3. Try RapidAPI "Informazioni Targhe" (RCA/insurance data only)
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (rapidApiKey) {
    const HOST = 'informazioni-targhe.p.rapidapi.com';
    const BASE = 'https://' + HOST;
    const h = { 'Content-Type': 'application/json', 'x-rapidapi-host': HOST, 'x-rapidapi-key': rapidApiKey };
    try {
      const r1 = await fetch(BASE + '/job/submit', { method: 'POST', headers: h, body: JSON.stringify({ targhe: [targa], op: 'rca' }) });
      if (!r1.ok) throw new Error('s' + r1.status);
      const j1 = await r1.json();
      if (!j1.job_id) throw new Error('noid');

      await new Promise(r => setTimeout(r, 2500));
      let r2 = await fetch(BASE + '/job/status?job=' + j1.job_id, { headers: h });
      let j2 = r2.ok ? await r2.json() : { completed: false };

      if (!j2.completed) {
        await new Promise(r => setTimeout(r, 2000));
        r2 = await fetch(BASE + '/job/status?job=' + j1.job_id, { headers: h });
        j2 = r2.ok ? await r2.json() : { completed: false };
      }

      if (!j2.completed) return res.status(200).json({ source: 'timeout', targa });

      const r3 = await fetch(BASE + '/job/retrieve?job=' + j1.job_id, { headers: h });
      if (!r3.ok) throw new Error('r' + r3.status);
      const j3 = await r3.json();
      if (!Array.isArray(j3) || !j3.length) return res.status(200).json({ source: 'none', targa });

      const d = j3[0].data || {};
      return res.status(200).json({
        source: 'rapidapi', targa: targa,
        tipoVeicolo: d.tipoVeicolo || '',
        descrizioneTipoVeicolo: d.descrizioneTipoVeicolo || '',
        compagniaAssicurativa: d.compagniaAssicurativa || '',
        numeroPolizza: d.numeroPolizza || '',
        dataScadenzaPolizza: d.dataScadenzaPolizza || '',
        assicurazionePresente: d.assicurazionePresente || 'false',
        assicurazioneSospesa: d.assicurazioneSospesa || 'false',
        theftstatus: d.theftstatus || null,
      });
    } catch (e) {
      console.error('RapidAPI error:', e);
    }
  }

  // 4. No API key configured — return instruction
  return res.status(200).json({
    source: 'none',
    targa,
    message: 'Nessuna API configurata. Aggiungi EVITAMULTE_KEY, OPENAPI_KEY o RAPIDAPI_KEY nelle variabili ambiente di Vercel.',
  });
}

function tradCarburante(fuel: string): string {
  if (!fuel) return '';
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('gasolio')) return 'Diesel';
  if (f.includes('benz') || f.includes('petrol')) return 'Benzina';
  if (f.includes('gpl') || f.includes('lpg')) return 'GPL';
  if (f.includes('metan') || f.includes('cng')) return 'Metano';
  if (f.includes('elettr') || f.includes('electr')) return 'Elettrica';
  if (f.includes('ibrid') || f.includes('hybrid')) return 'Ibrida';
  return fuel;
}
