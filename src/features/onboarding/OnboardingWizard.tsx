import { useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import {
  validateEmail,
  validateRequired,
  validatePhone,
  validatePartitaIVA,
} from '@/lib/validation';

// ============================================
// Types
// ============================================

interface OfficinaData {
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  telefono: string;
  email: string;
  piva: string;
  logoFile: File | null;
  logoPreview: string | null;
}

interface ServizioOption {
  id: string;
  label: string;
  checked: boolean;
}

interface OrarioGiorno {
  giorno: string;
  attivo: boolean;
  apertura: string;
  chiusura: string;
}

interface TeamMember {
  id: string;
  nome: string;
  email: string;
  ruolo: 'titolare' | 'meccanico' | 'elettrauto' | 'reception';
}

type StepErrors = Record<string, string | null>;

const STEPS = [
  { num: 1, label: 'Dati Officina' },
  { num: 2, label: 'Servizi e Orari' },
  { num: 3, label: 'Il tuo team' },
  { num: 4, label: 'Pronti!' },
];

const SERVIZI_DEFAULT: ServizioOption[] = [
  { id: 'meccanica', label: 'Meccanica generale', checked: false },
  { id: 'elettrauto', label: 'Elettrauto', checked: false },
  { id: 'gommista', label: 'Gommista', checked: false },
  { id: 'carrozzeria', label: 'Carrozzeria', checked: false },
  { id: 'tagliandi', label: 'Tagliandi', checked: false },
  { id: 'revisioni', label: 'Revisioni', checked: false },
  { id: 'diagnostica', label: 'Diagnostica', checked: false },
  { id: 'climatizzazione', label: 'Climatizzazione', checked: false },
];

const ORARI_DEFAULT: OrarioGiorno[] = [
  { giorno: 'Lunedi', attivo: true, apertura: '08:00', chiusura: '18:00' },
  { giorno: 'Martedi', attivo: true, apertura: '08:00', chiusura: '18:00' },
  { giorno: 'Mercoledi', attivo: true, apertura: '08:00', chiusura: '18:00' },
  { giorno: 'Giovedi', attivo: true, apertura: '08:00', chiusura: '18:00' },
  { giorno: 'Venerdi', attivo: true, apertura: '08:00', chiusura: '18:00' },
  { giorno: 'Sabato', attivo: true, apertura: '08:00', chiusura: '13:00' },
  { giorno: 'Domenica', attivo: false, apertura: '08:00', chiusura: '13:00' },
];

// ============================================
// Main Component
// ============================================

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { officina, utente } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [officinaData, setOfficinaData] = useState<OfficinaData>({
    nome: officina?.nome || '',
    indirizzo: officina?.indirizzo || '',
    citta: '',
    cap: '',
    telefono: officina?.tel || '',
    email: officina?.email || '',
    piva: officina?.p_iva || '',
    logoFile: null,
    logoPreview: null,
  });
  const [step1Errors, setStep1Errors] = useState<StepErrors>({});

  // Step 2 state
  const [servizi, setServizi] = useState<ServizioOption[]>(SERVIZI_DEFAULT);
  const [orari, setOrari] = useState<OrarioGiorno[]>(ORARI_DEFAULT);

  // Step 3 state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: crypto.randomUUID(),
      nome: utente?.nome || '',
      email: utente?.email || '',
      ruolo: 'titolare',
    },
  ]);
  const [newMember, setNewMember] = useState({ nome: '', email: '', ruolo: 'meccanico' as TeamMember['ruolo'] });
  const [step3Errors, setStep3Errors] = useState<StepErrors>({});

  // Animation state for step 4
  const [showCheck, setShowCheck] = useState(false);

  // ---- Step 1: Validation ----
  const validateStep1 = useCallback((): boolean => {
    const errors: StepErrors = {};
    errors.nome = validateRequired(officinaData.nome, 'Il nome');
    errors.indirizzo = validateRequired(officinaData.indirizzo, "L'indirizzo");
    errors.citta = validateRequired(officinaData.citta, 'La citta');
    errors.cap = !officinaData.cap.trim()
      ? 'Il CAP e obbligatorio'
      : !/^\d{5}$/.test(officinaData.cap.trim())
        ? 'Il CAP deve essere di 5 cifre'
        : null;
    errors.telefono = !officinaData.telefono.trim()
      ? 'Il telefono e obbligatorio'
      : validatePhone(officinaData.telefono);
    errors.email = validateEmail(officinaData.email);
    errors.piva = !officinaData.piva.trim()
      ? 'La partita IVA e obbligatoria'
      : validatePartitaIVA(officinaData.piva);
    setStep1Errors(errors);
    return Object.values(errors).every((e) => e === null);
  }, [officinaData]);

  // ---- Step 1: Logo handling ----
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setOfficinaData((prev) => ({
        ...prev,
        logoFile: file,
        logoPreview: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoSelect(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLogoSelect(file);
  };

  // ---- Step 2: Handlers ----
  const toggleServizio = (id: string) => {
    setServizi((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    );
  };

  const updateOrario = (index: number, field: keyof OrarioGiorno, value: string | boolean) => {
    setOrari((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    );
  };

  // ---- Step 3: Handlers ----
  const addTeamMember = () => {
    const errors: StepErrors = {};
    errors.memberNome = validateRequired(newMember.nome, 'Il nome');
    errors.memberEmail = validateEmail(newMember.email);
    setStep3Errors(errors);
    if (Object.values(errors).some((e) => e !== null)) return;

    setTeamMembers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...newMember },
    ]);
    setNewMember({ nome: '', email: '', ruolo: 'meccanico' });
    setStep3Errors({});
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // ---- Save logic ----
  const uploadLogo = async (file: File, officinaId: string): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${officinaId}/logo.${ext}`;

    // Remove old logo if it exists (ignore errors)
    await supabase.storage.from('logos').remove([filePath]);

    const { error } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (error) {
      console.error('Logo upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return urlData?.publicUrl ?? null;
  };

  const saveStep1 = async () => {
    if (!officina?.id) return;
    const fullIndirizzo = `${officinaData.indirizzo}, ${officinaData.cap} ${officinaData.citta}`;

    // Upload logo if a file was selected
    let logoUrl: string | null | undefined;
    if (officinaData.logoFile) {
      logoUrl = await uploadLogo(officinaData.logoFile, officina.id);
    }

    const updatePayload: Record<string, unknown> = {
      nome: officinaData.nome,
      indirizzo: fullIndirizzo,
      tel: officinaData.telefono,
      email: officinaData.email,
      p_iva: officinaData.piva,
    };

    if (logoUrl) {
      updatePayload.logo_url = logoUrl;
    }

    await supabase
      .from('officine')
      .update(updatePayload)
      .eq('id', officina.id);
  };

  const saveStep2 = async () => {
    if (!officina?.id) return;
    const serviziAttivi = servizi
      .filter((s) => s.checked)
      .map((s) => ({ id: s.id, label: s.label }));

    const orariData = orari.map((o) => ({
      giorno: o.giorno,
      attivo: o.attivo,
      apertura: o.apertura,
      chiusura: o.chiusura,
    }));

    await supabase
      .from('officine')
      .update({
        servizi: serviziAttivi,
        orari_apertura: orariData,
      })
      .eq('id', officina.id);
  };

  const saveStep3 = async () => {
    if (!officina?.id) return;
    // Save new team members (skip the owner who already exists)
    const newMembers = teamMembers.filter((m) => m.email !== utente?.email);
    const membriFalliti: string[] = [];
    for (const member of newMembers) {
      const { error: membroErr } = await supabase.from('utenti').upsert(
        {
          officina_id: officina.id,
          nome: member.nome,
          email: member.email,
          ruolo: member.ruolo === 'meccanico' || member.ruolo === 'elettrauto'
            ? 'operaio'
            : member.ruolo === 'reception'
              ? 'reception'
              : 'titolare',
          tel: '',
          attivo: true,
        },
        { onConflict: 'email' }
      );
      // Senza controllo i membri del team venivano persi in silenzio.
      if (membroErr) membriFalliti.push(`${member.nome} (${membroErr.message})`);
    }
    if (membriFalliti.length > 0) {
      alert('Alcuni membri del team non sono stati aggiunti:\n' + membriFalliti.join('\n'));
    }
  };

  // ---- Navigation ----
  const goNext = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setSaving(true);
      await saveStep1();
      setSaving(false);
    }
    if (currentStep === 2) {
      setSaving(true);
      await saveStep2();
      setSaving(false);
    }
    if (currentStep === 3) {
      if (teamMembers.length === 0) {
        setStep3Errors({ team: 'Aggiungi almeno un membro del team' });
        return;
      }
      setSaving(true);
      await saveStep3();
      setSaving(false);
    }
    if (currentStep < 4) {
      setCurrentStep((s) => s + 1);
      if (currentStep + 1 === 4) {
        setTimeout(() => setShowCheck(true), 300);
      }
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleFinish = () => {
    onComplete();
  };

  // ---- Field updater ----
  const updateField = (field: keyof OfficinaData, value: string) => {
    setOfficinaData((prev) => ({ ...prev, [field]: value }));
    if (step1Errors[field]) {
      setStep1Errors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Benvenuto in <span className="text-blue-600">OfficinAI</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Configura la tua officina in pochi passi
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                      transition-all duration-300
                      ${currentStep === step.num
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900 scale-110'
                        : currentStep > step.num
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }
                    `}
                  >
                    {currentStep > step.num ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.num
                    )}
                  </div>
                  <span
                    className={`
                      text-xs mt-1.5 font-medium hidden sm:block
                      ${currentStep === step.num
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-4">
                    <div
                      className={`
                        h-1 rounded-full transition-all duration-500
                        ${currentStep > step.num
                          ? 'bg-blue-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                        }
                      `}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="transition-all duration-300">
          {currentStep === 1 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Dati Officina
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Inserisci le informazioni principali della tua officina
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Nome officina *"
                    value={officinaData.nome}
                    onChange={(e) => updateField('nome', e.target.value)}
                    placeholder="Es. Autofficina Rossi"
                    error={step1Errors.nome || undefined}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label="Indirizzo *"
                    value={officinaData.indirizzo}
                    onChange={(e) => updateField('indirizzo', e.target.value)}
                    placeholder="Via Roma 1"
                    error={step1Errors.indirizzo || undefined}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <Input
                  label="Citta *"
                  value={officinaData.citta}
                  onChange={(e) => updateField('citta', e.target.value)}
                  placeholder="Milano"
                  error={step1Errors.citta || undefined}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <Input
                  label="CAP *"
                  value={officinaData.cap}
                  onChange={(e) => updateField('cap', e.target.value)}
                  placeholder="20100"
                  maxLength={5}
                  error={step1Errors.cap || undefined}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <Input
                  label="Telefono *"
                  type="tel"
                  value={officinaData.telefono}
                  onChange={(e) => updateField('telefono', e.target.value)}
                  placeholder="+39 02 1234567"
                  error={step1Errors.telefono || undefined}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <Input
                  label="Email *"
                  type="email"
                  value={officinaData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="info@officinarossi.it"
                  error={step1Errors.email || undefined}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Partita IVA *"
                    value={officinaData.piva}
                    onChange={(e) => updateField('piva', e.target.value)}
                    placeholder="12345678901"
                    maxLength={11}
                    error={step1Errors.piva || undefined}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                {/* Logo Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Logo (opzionale)
                  </label>
                  <div
                    className={`
                      border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                      transition-colors
                      border-gray-300 hover:border-blue-400
                      dark:border-gray-600 dark:hover:border-blue-500
                      bg-gray-50 dark:bg-gray-700/50
                    `}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {officinaData.logoPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={officinaData.logoPreview}
                          alt="Logo preview"
                          className="h-20 w-20 object-contain rounded-lg"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Clicca o trascina per cambiare
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                        </svg>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Trascina qui il logo o <span className="text-blue-600 font-medium">sfoglia</span>
                        </span>
                        <span className="text-xs text-gray-400">PNG, JPG fino a 2MB</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Servizi e Orari
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Seleziona i servizi offerti e imposta gli orari di apertura
              </p>

              {/* Services */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Servizi offerti
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {servizi.map((s) => (
                    <label
                      key={s.id}
                      className={`
                        flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-sm
                        ${s.checked
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                          : 'border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={s.checked}
                        onChange={() => toggleServizio(s.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 dark:text-gray-200">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Working Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Orari di apertura
                </h3>
                <div className="space-y-2">
                  {orari.map((o, idx) => (
                    <div
                      key={o.giorno}
                      className={`
                        flex items-center gap-3 p-3 rounded-xl transition-colors
                        ${o.attivo
                          ? 'bg-white dark:bg-gray-700'
                          : 'bg-gray-50 dark:bg-gray-800 opacity-60'
                        }
                      `}
                    >
                      <label className="flex items-center gap-2 min-w-[130px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={o.attivo}
                          onChange={() => updateOrario(idx, 'attivo', !o.attivo)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {o.giorno}
                        </span>
                      </label>
                      {o.attivo && (
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="time"
                            value={o.apertura}
                            onChange={(e) => updateOrario(idx, 'apertura', e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white text-sm"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="time"
                            value={o.chiusura}
                            onChange={(e) => updateOrario(idx, 'chiusura', e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white text-sm"
                          />
                        </div>
                      )}
                      {!o.attivo && (
                        <span className="text-sm text-gray-400 italic">Chiuso</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Il tuo team
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Aggiungi i membri del tuo team
              </p>

              {/* Current members */}
              <div className="space-y-2 mb-6">
                {teamMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {m.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{m.nome}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`
                        text-xs font-medium px-2 py-1 rounded-full
                        ${m.ruolo === 'titolare'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : m.ruolo === 'meccanico'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : m.ruolo === 'elettrauto'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }
                      `}>
                        {m.ruolo.charAt(0).toUpperCase() + m.ruolo.slice(1)}
                      </span>
                      {m.ruolo !== 'titolare' && (
                        <button
                          onClick={() => removeTeamMember(m.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Rimuovi"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {step3Errors.team && (
                <p className="text-sm text-red-500 mb-4">{step3Errors.team}</p>
              )}

              {/* Add member form */}
              <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Aggiungi membro
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    placeholder="Nome e cognome"
                    value={newMember.nome}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, nome: e.target.value }))}
                    error={step3Errors.memberNome || undefined}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, email: e.target.value }))}
                    error={step3Errors.memberEmail || undefined}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newMember.ruolo}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, ruolo: e.target.value as TeamMember['ruolo'] }))}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="meccanico">Meccanico</option>
                      <option value="elettrauto">Elettrauto</option>
                      <option value="reception">Reception</option>
                      <option value="titolare">Titolare</option>
                    </select>
                    <Button onClick={addTeamMember} size="md">
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700 text-center">
              {/* Animated checkmark */}
              <div className="flex justify-center mb-6">
                <div
                  className={`
                    w-24 h-24 rounded-full flex items-center justify-center
                    transition-all duration-700 ease-out
                    ${showCheck
                      ? 'bg-green-100 dark:bg-green-900/30 scale-100 opacity-100'
                      : 'bg-green-100 dark:bg-green-900/30 scale-50 opacity-0'
                    }
                  `}
                >
                  <svg
                    className={`
                      w-12 h-12 text-green-600 dark:text-green-400
                      transition-all duration-500 delay-300
                      ${showCheck ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
                    `}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Tutto pronto!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                La tua officina e configurata. Ecco un riepilogo:
              </p>

              {/* Summary */}
              <div className="text-left max-w-md mx-auto space-y-4 mb-8">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Officina</h4>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{officinaData.nome}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {officinaData.indirizzo}, {officinaData.cap} {officinaData.citta}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">P.IVA: {officinaData.piva}</p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Servizi attivi</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {servizi.filter((s) => s.checked).length > 0 ? (
                      servizi
                        .filter((s) => s.checked)
                        .map((s) => (
                          <span
                            key={s.id}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
                          >
                            {s.label}
                          </span>
                        ))
                    ) : (
                      <span className="text-xs text-gray-400">Nessun servizio selezionato</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Team</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membri'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {teamMembers.map((m) => (
                      <span key={m.id} className="text-xs text-gray-500 dark:text-gray-400">
                        {m.nome}{teamMembers.indexOf(m) < teamMembers.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={handleFinish}>
                  Vai alla dashboard
                </Button>
                <Button size="lg" variant="secondary" onClick={handleFinish}>
                  Aggiungi il primo cliente
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 4 && (
          <div className="flex justify-between mt-6">
            <div>
              {currentStep > 1 && (
                <Button variant="ghost" onClick={goBack}>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Indietro
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              {currentStep === 2 && (
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                  Salta
                </Button>
              )}
              <Button onClick={goNext} loading={saving}>
                Avanti
                {!saving && (
                  <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
