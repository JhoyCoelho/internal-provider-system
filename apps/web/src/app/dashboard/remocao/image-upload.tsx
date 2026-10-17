'use client';

import { ChangeEvent, useState } from 'react';

type ImageUploadProps = {
  label: string;
  previewAlt: string;
  value: string;
  fileName: string;
  onChange: (imageDataUrl: string, fileName: string) => void;
  onRemove: () => void;
};

const maxImageBytes = 700 * 1024;

async function compressImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível abrir esta imagem. Tente selecionar um arquivo JPG ou PNG.'));
      image.src = objectUrl;
    });

    const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
    if (!maxDimension) throw new Error('A imagem selecionada está vazia ou não é compatível.');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem para envio.');

    let scale = Math.min(1, 1600 / maxDimension);
    let quality = 0.82;
    let compressed: Blob | null = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (compressed && compressed.size <= maxImageBytes) break;
      if (quality > 0.5) quality -= 0.08;
      else {
        scale *= 0.82;
        quality = 0.82;
      }
    }

    if (!compressed || compressed.size > maxImageBytes) throw new Error('A imagem é muito grande para envio. Escolha outra foto.');

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem selecionada.'));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      reader.readAsDataURL(compressed);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUpload({ label, previewAlt, value, fileName, onChange, onRemove }: ImageUploadProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }

    setError(null);
    setProcessing(true);
    try {
      onChange(await compressImage(file), file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível preparar a imagem.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-within:outline-2 focus-within:outline-brand-600">
          <span>{processing ? 'Preparando imagem...' : 'Selecionar imagem'}</span>
          <input type="file" accept="image/*" disabled={processing} onChange={(event) => void handleFileChange(event)} className="sr-only" />
        </label>
        <span className="max-w-full break-all text-xs text-slate-500">{fileName || 'Nenhuma imagem selecionada'}</span>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {value && <div className="flex items-center gap-3"><img src={value} alt={previewAlt} className="h-20 w-28 rounded-md object-cover" /><button type="button" onClick={onRemove} className="text-sm text-rose-700">Remover imagem</button></div>}
    </div>
  );
}