import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DatabaseStatus } from './DatabaseStatus';
import { useThemeStore } from '@/stores/themeStore';
import type { Utente } from '@/types/database';

const RUOLO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  titolare: { label: 'Titolare', color: 'text-amber-700', bg: 'bg-amber-100' },
  operaio: { label: 'Operaio', color: 'text-blue-700', bg: 'bg-blue-100' },
  reception: { label: 'Reception', color: 'text-green-700', bg: 'bg-green-100' },
};

export function SettingsPage() {
  const { officina, utente, logout, updateOfficina } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [nome, setNome] = useState(officina?.nome || '');
  const [indirizzo, setIndirizzo] = useState(officina?.indirizzo || '');
  const [tel, setTel] = useState(officina?.tel || '');
  const [email, setEmail] = useState(officina?.email || '');
  const [pIva, setPIva] = useState(officina?.p_iva || '');
  const [logoUrl, setLogoUrl] = useState(officina?.logo_url || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [team, setTeam] = useState<Utente[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTel, setNewTel] = useState('');
  const [newRuolo, setNewRuolo] = useState<'operaio' | 'reception' | 'titolare'>('operaio');
  const [teamToast, setTeamToast] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const isTitolare = utente?.ruolo === 'titolare';

  useEffect(() => {
    if (!officina?.id) return;
    const loadTeam = async () => {
      const { data } = await supabase
        .from('utenti')
        .select('*')
        .eq('officina_id', officina.id)
        .order('created_at');
      setTeam(data || []);
      setLoadingTeam(false);
    };
    loadTeam();
  }, [officina?.id]);

  const showTeamToast = (msg: string) => {
    setTeamToast(msg);
    setTimeout(() => setTeamToast(null), 3000);
  };

  const addMember = async () => {
    if (!officina?.id || !newNome.trim() || !newEmail.trim()) return;
    const { data, error } = await supabase
      .from('utenti')
      .insert({
        officina_id: officina.id,
        nome: newNome.trim(),
        email: newEmail.trim().toLowerCase(),
        tel: newTel.trim(),
        ruolo: newRuolo,
        attivo: true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        showTeamToast('Email già esistente nel sistema');
      } else {
        showTeamToast('Errore: ' + error.message);
      }
      return;
    }
    if (data) {
      setTeam([...team, data]);
      setNewNome('');
      setNewEmail('');
      setNewTel('');
      setNewRuolo('operaio');
      setShowAddMember(false);
      showTeamToast(`${data.nome} aggiunto al team`);
    }
  };

  const toggleAttivo = async (id: string, current: boolean) => {
    if (id === utente?.id) return;
    const action = current ? 'disattivare' : 'approvare/riattivare';
    if (!confirm(`Vuoi ${action} questo membro del team?`)) return;
    const { error } = await supabase.from('utenti').update({ attivo: !current }).eq('id', id);
    if (error) { showTeamToast('Non riuscito: ' + error.message); return; }
    setTeam(team.map((m) => (m.id === id ? { ...m, attivo: !current } : m)));
    showTeamToast(current ? 'Membro disattivato' : 'Membro attivato');
  };

  const updateMemberRole = async (id: string, ruolo: string) => {
    const { error } = await supabase.from('utenti').update({ ruolo }).eq('id', id);
    if (error) { showTeamToast('Ruolo non aggiornato: ' + error.message); return; }
    setTeam(team.map((m) => (m.id === id ? { ...m, ruolo: ruolo as Utente['ruolo'] } : m)));
    showTeamToast('Ruolo aggiornato');
  };

  const updateMemberField = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from('utenti').update({ [field]: value }).eq('id', id);
    if (error) { showTeamToast('Modifica non salvata: ' + error.message); return; }
    setTeam(team.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const deleteMember = async (id: string, nome: string) => {
    if (id === utente?.id) return;
    if (!confirm(`Eliminare definitivamente ${nome} dal team? Questa azione è irreversibile.`)) return;
    const { error } = await supabase.from('utenti').delete().eq('id', id);
    if (error) { showTeamToast('Non rimosso: ' + error.message); return; }
    setTeam(team.filter((m) => m.id !== id));
    showTeamToast(`${nome} rimosso dal team`);
  };

  const salva = async () => {
    if (!officina) return;
    setSaving(true);
    setSaveError('');
    const patch = { nome, indirizzo, tel, email, p_iva: pIva, logo_url: logoUrl || null };
    const { error } = await supabase.from('officine').update(patch).eq('id', officina.id);
    setSaving(false);
    if (error) {
      setSaveError('Errore salvataggio: ' + error.message);
      return;
    }
    // Aggiorna lo store, altrimenti intestazione, PDF e dashboard
    // continuerebbero a mostrare i dati precedenti fino al riavvio dell'app.
    updateOfficina(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const uploadLogo = async (file: File) => {
    if (!officina) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Il file supera i 2MB. Riduci la dimensione del logo.');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${officina.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type });

      let url: string;
      if (upErr) {
        // Fallback: se il bucket Storage non esiste, salva il logo come data URL.
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Lettura del file non riuscita'));
          reader.readAsDataURL(file);
        });
      } else {
        url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
      }

      const { error: updErr } = await supabase
        .from('officine')
        .update({ logo_url: url })
        .eq('id', officina.id);
      if (updErr) {
        alert('Logo non salvato: ' + updErr.message);
        return;
      }
      setLogoUrl(url);
      updateOfficina({ logo_url: url });
    } catch (e) {
      alert('Logo non caricato: ' + (e instanceof Error ? e.message : 'errore sconosciuto'));
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Impostazioni</h2>

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Tema</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'light' as const, label: 'Chiaro', icon: '☀️' },
            { value: 'dark' as const, label: 'Scuro', icon: '🌙' },
            { value: 'system' as const, label: 'Sistema', icon: '💻' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer ${
                theme === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className={`text-xs font-medium ${
                theme === opt.value
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Lingua</h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'it', label: 'Italiano', icon: '🇮🇹' },
            { value: 'en', label: 'English', icon: '🇬🇧' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                i18n.changeLanguage(opt.value);
                localStorage.setItem('officinai_lang', opt.value);
              }}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer ${
                i18n.language === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className={`text-xs font-medium ${
                i18n.language === opt.value
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {saved && (
        <Card className="!p-3 bg-emerald-50 !border-emerald-200">
          <div className="text-sm font-semibold text-emerald-800">✅ Salvato con successo!</div>
        </Card>
      )}

      {saveError && (
        <Card className="!p-3 bg-red-50 !border-red-200">
          <div className="text-sm font-semibold text-red-800">⚠️ {saveError}</div>
        </Card>
      )}

      <DatabaseStatus />

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Logo officina</h3>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className="text-3xl">🔧</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label className="block w-full">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Carica dal tuo dispositivo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }}
                disabled={uploadingLogo}
                className="w-full text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-blue-700 cursor-pointer disabled:opacity-50"
              />
            </label>
            <Input label="Oppure incolla un URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            {uploadingLogo && <div className="text-xs text-blue-600">Caricamento in corso...</div>}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Dati officina</h3>
        <div className="space-y-3">
          <Input label="Nome officina" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input label="Indirizzo" value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefono" value={tel} onChange={(e) => setTel(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input label="Partita IVA" value={pIva} onChange={(e) => setPIva(e.target.value)} />
          <Button onClick={salva} loading={saving} fullWidth>
            Salva modifiche
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Il tuo profilo</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Nome</span>
            <span className="font-medium text-gray-900">{utente?.nome}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{utente?.email}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Ruolo</span>
            <span className="font-medium text-gray-900 capitalize">{utente?.ruolo}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Piano</span>
            <span className="font-medium text-blue-600 capitalize">{officina?.piano || 'Pro'}</span>
          </div>
        </div>
      </Card>

      {isTitolare && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Team officina</h3>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer"
            >
              {showAddMember ? '✗ Annulla' : '+ Aggiungi membro'}
            </button>
          </div>

          {teamToast && (
            <div className="mb-3 p-2.5 rounded-lg bg-gray-900 text-white text-xs text-center">
              {teamToast}
            </div>
          )}

          {showAddMember && (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-blue-900 mb-1">Nuovo membro</div>
              <input
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Nome e cognome"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={newTel}
                  onChange={(e) => setNewTel(e.target.value)}
                  placeholder="Telefono"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={newRuolo}
                  onChange={(e) => setNewRuolo(e.target.value as 'operaio' | 'reception' | 'titolare')}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="operaio">Operaio / Meccanico</option>
                  <option value="reception">Reception</option>
                  <option value="titolare">Titolare</option>
                </select>
                <Button onClick={addMember} size="sm">Aggiungi</Button>
              </div>
            </div>
          )}

          {loadingTeam ? (
            <div className="text-center py-3 text-xs text-gray-400">Caricamento team...</div>
          ) : (
            <div className="space-y-2">
              {team.map((m) => {
                const rCfg = RUOLO_CONFIG[m.ruolo] || RUOLO_CONFIG.operaio;
                const isMe = m.id === utente?.id;
                const isEditing = editingMember === m.id;
                return (
                  <div
                    key={m.id}
                    className={`border rounded-xl p-3 transition-colors ${
                      !m.attivo ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    }`}
                  >
                    {!isEditing ? (
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${rCfg.bg} ${rCfg.color}`}>
                          {m.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{m.nome}</span>
                            {isMe && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Tu</span>}
                            {!m.attivo && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">In attesa di approvazione</span>}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">{m.email}</div>
                        </div>
                        <Badge color={rCfg.color} bg={rCfg.bg}>{rCfg.label}</Badge>
                        {!isMe && !m.attivo && (
                          <button
                            onClick={() => toggleAttivo(m.id, m.attivo)}
                            className="text-[10px] px-2 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                            title="Approva l'iscrizione di questo membro"
                          >✓ Approva</button>
                        )}
                        {!isMe && (
                          <button
                            onClick={() => setEditingMember(m.id)}
                            className="text-gray-400 hover:text-blue-600 cursor-pointer text-sm"
                            title="Modifica"
                          >✏️</button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={m.nome}
                            onChange={(e) => setTeam(team.map((t) => (t.id === m.id ? { ...t, nome: e.target.value } : t)))}
                            onBlur={() => updateMemberField(m.id, 'nome', m.nome)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-sm">✗</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={m.email}
                            onChange={(e) => setTeam(team.map((t) => (t.id === m.id ? { ...t, email: e.target.value } : t)))}
                            onBlur={() => updateMemberField(m.id, 'email', m.email)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            value={m.tel}
                            onChange={(e) => setTeam(team.map((t) => (t.id === m.id ? { ...t, tel: e.target.value } : t)))}
                            onBlur={() => updateMemberField(m.id, 'tel', m.tel)}
                            placeholder="Telefono"
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={m.ruolo}
                            onChange={(e) => updateMemberRole(m.id, e.target.value)}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="operaio">Operaio</option>
                            <option value="reception">Reception</option>
                            <option value="titolare">Titolare</option>
                          </select>
                          <button
                            onClick={() => toggleAttivo(m.id, m.attivo)}
                            className={`text-[10px] px-2 py-1 rounded-lg cursor-pointer ${
                              m.attivo ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {m.attivo ? 'Disattiva' : '✓ Approva'}
                          </button>
                          <button
                            onClick={() => deleteMember(m.id, m.nome)}
                            className="text-[10px] px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {team.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400">Nessun membro nel team</div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Abbonamento</h3>
        <div className="bg-blue-50 rounded-xl p-4 text-center mb-3">
          <div className="text-2xl font-bold text-blue-600">Pro</div>
          <div className="text-sm text-gray-600">€99/mese • 5 tecnici</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ Agenda</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ Preventivi</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ Chat</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ Foto</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ WhatsApp</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <div className="font-bold text-gray-900">✅ AI Diagnostica</div>
          </div>
        </div>
      </Card>

      <Card className="!border-red-200">
        <h3 className="font-semibold text-red-600 mb-3">Zona pericolosa</h3>
        <Button variant="danger" fullWidth onClick={logout}>
          Esci dall'account
        </Button>
      </Card>

      <div className="text-center text-xs text-gray-300 pt-4">
        OfficinAI v2.0 • React + TypeScript + Supabase
      </div>
    </div>
  );
}
