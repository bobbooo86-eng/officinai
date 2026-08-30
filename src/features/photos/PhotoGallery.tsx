import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { FOTO_CATEGORIE } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import type { Foto, FotoCategoria } from '@/types/database';

interface PhotoGalleryProps {
  appuntamentoId: string;
  readOnly?: boolean; // For customer view
}

export function PhotoGallery({ appuntamentoId, readOnly = false }: PhotoGalleryProps) {
  const { utente } = useAuthStore();
  const [foto, setFoto] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [categoria, setCategoria] = useState<FotoCategoria>('durante');
  const [selectedFoto, setSelectedFoto] = useState<Foto | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFoto();
  }, [appuntamentoId]);

  const fetchFoto = async () => {
    const query = supabase
      .from('foto')
      .select('*')
      .eq('appuntamento_id', appuntamentoId)
      .order('created_at', { ascending: false });

    // Customers only see photos marked as visible
    if (readOnly) {
      query.eq('visibile_cliente', true);
    }

    const { data } = await query;
    setFoto(data || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    let failedCount = 0;

    for (const file of Array.from(files)) {
      try {
        // Generate unique filename
        const ext = file.name.split('.').pop();
        const fileName = `${appuntamentoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: storageError } = await supabase.storage
          .from('foto-lavorazione')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (storageError) {
          console.error('Upload error:', storageError);
          failedCount++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('foto-lavorazione')
          .getPublicUrl(fileName);

        // Save to database
        const { error: dbError } = await supabase.from('foto').insert({
          appuntamento_id: appuntamentoId,
          categoria,
          url: urlData.publicUrl,
          descrizione: '',
          visibile_cliente: true,
          tecnico_id: utente?.id || null,
        });

        // Il file finiva su Storage ma senza la riga a database la foto non
        // compariva mai, pur risultando caricata con successo.
        if (dbError) {
          console.error('Foto non registrata:', dbError);
          failedCount++;
          await supabase.storage.from('foto-lavorazione').remove([fileName]);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        failedCount++;
      }
    }

    setUploading(false);
    if (failedCount > 0) {
      setUploadError(`${failedCount} foto non ${failedCount === 1 ? 'caricata' : 'caricate'}. Riprova.`);
    }
    fetchFoto();

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const deleteFoto = async (foto: Foto) => {
    // Extract path from URL
    const urlParts = foto.url.split('/foto-lavorazione/');
    if (urlParts[1]) {
      await supabase.storage.from('foto-lavorazione').remove([urlParts[1]]);
    }
    await supabase.from('foto').delete().eq('id', foto.id);
    setFoto((prev) => prev.filter((f) => f.id !== foto.id));
    setSelectedFoto(null);
  };

  const categoriaLabel = (cat: string) => FOTO_CATEGORIE.find((c) => c.value === cat)?.label || cat;

  if (loading) {
    return <div className="text-center py-4 text-sm text-gray-400">Caricamento foto...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Upload section (only for workshop) */}
      {!readOnly && (
        <Card className="!p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900">Aggiungi foto</span>
          </div>

          {/* Category selector */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {FOTO_CATEGORIE.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoria(cat.value as FotoCategoria)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  categoria === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Upload button */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            📸 {uploading ? 'Caricamento...' : `Scatta / Seleziona foto (${categoriaLabel(categoria)})`}
          </Button>
          {uploadError && (
            <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
              <span>{uploadError}</span>
              <button
                onClick={() => setUploadError(null)}
                className="ml-2 text-red-400 hover:text-red-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Photo grid */}
      {foto.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📷</div>
          <p className="text-sm text-gray-400">Nessuna foto {readOnly ? 'disponibile' : 'caricata'}</p>
        </div>
      ) : (
        <>
          {/* Group by category */}
          {FOTO_CATEGORIE.map((cat) => {
            const catFoto = foto.filter((f) => f.categoria === cat.value);
            if (catFoto.length === 0) return null;
            return (
              <div key={cat.value}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="#374151" bg="#f3f4f6">{cat.label}</Badge>
                  <span className="text-xs text-gray-400">({catFoto.length})</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {catFoto.map((f) => (
                    <div
                      key={f.id}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer group"
                      onClick={() => setSelectedFoto(f)}
                    >
                      <img
                        src={f.url}
                        alt={f.descrizione || cat.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                      {!readOnly && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Lightbox */}
      {selectedFoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedFoto(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedFoto.url}
              alt={selectedFoto.descrizione || ''}
              className="w-full rounded-2xl"
            />
            <div className="mt-3 flex items-center justify-between">
              <div>
                <Badge color="#fff" bg="rgba(255,255,255,0.2)">
                  {categoriaLabel(selectedFoto.categoria)}
                </Badge>
                {selectedFoto.descrizione && (
                  <p className="text-white text-sm mt-1">{selectedFoto.descrizione}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!readOnly && (
                  <button
                    onClick={() => deleteFoto(selectedFoto)}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Elimina
                  </button>
                )}
                <button
                  onClick={() => setSelectedFoto(null)}
                  className="px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
