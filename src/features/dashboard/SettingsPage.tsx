import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function SettingsPage() {
  const { officina, utente, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Officina form
  const [nome, setNome] = useState(officina?.nome || '');
  const [indirizzo, setIndirizzo] = useState(officina?.indirizzo || '');
  const [tel, setTel] = useState(officina?.tel || '');
  const [email, setEmail] = useState(officina?.email || '');
  const [pIva, setPIva] = useState(officina?.p_iva || '');

  const salva = async () => {
    if (!officina) return;
    setSaving(true);
    await supabase
      .from('officine')
      .update({ nome, indirizzo, tel, email, p_iva: pIva })
      .eq('id', officina.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Impostazioni</h2>

      {/* Success message */}
      {saved && (
        <Card className="!p-3 bg-emerald-50 !border-emerald-200">
          <div className="text-sm font-semibold text-emerald-800">✅ Salvato con successo!</div>
        </Card>
      )}

      {/* Officina info */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Dati officina</h3>
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

      {/* User info */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Il tuo profilo</h3>
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

      {/* Subscription */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Abbonamento</h3>
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

      {/* Danger zone */}
      <Card className="!border-red-200">
        <h3 className="font-semibold text-red-600 mb-3">Zona pericolosa</h3>
        <Button variant="danger" fullWidth onClick={logout}>
          Esci dall'account
        </Button>
      </Card>

      {/* App version */}
      <div className="text-center text-xs text-gray-300 pt-4">
        OfficinAI v2.0 • React + TypeScript + Supabase
      </div>
    </div>
  );
}
