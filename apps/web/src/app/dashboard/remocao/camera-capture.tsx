'use client';

import { useEffect, useRef, useState } from 'react';

type CameraCaptureProps = {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
};

const maxImageBytes = 700 * 1024;

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => setError('Não foi possível iniciar a prévia da câmera.'));
    }
  }, [stream]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setStarting(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera exige uma conexão HTTPS e um navegador compatível.');
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = cameraStream;
      setStream(cameraStream);
    } catch (cameraError) {
      setError(cameraError instanceof Error && cameraError.name === 'NotAllowedError'
        ? 'Acesso à câmera negado. Permita a câmera nas configurações do navegador e tente novamente.'
        : cameraError instanceof Error ? cameraError.message : 'Não foi possível acessar a câmera.');
    } finally {
      setStarting(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError('A câmera ainda está iniciando. Aguarde um instante e tente novamente.');
      return;
    }

    setCapturing(true);
    setError(null);
    const canvas = document.createElement('canvas');
    let scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    let quality = 0.72;
    let image: Blob | null = null;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a imagem.');
      for (let attempt = 0; attempt < 8; attempt += 1) {
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (image && image.size <= maxImageBytes) break;
        if (quality > 0.48) quality -= 0.08;
        else scale *= 0.82;
      }
      if (!image || image.size > maxImageBytes) throw new Error('A imagem não pôde ser reduzida o suficiente. Tente novamente.');
      const compressedImage = image;

      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem.'));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(compressedImage);
      });
      stopStream();
      onCapture(imageDataUrl);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Não foi possível registrar a foto.');
    } finally {
      setCapturing(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Captura de foto">
      {stream ? <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] w-full rounded-lg bg-slate-950 object-contain" /> : <p className="text-sm text-slate-600">A câmera usa somente a imagem capturada agora. O navegador pode solicitar permissão na primeira utilização.</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!stream && <button type="button" disabled={starting} onClick={() => void startCamera()} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{starting ? 'Abrindo câmera...' : 'Ativar câmera'}</button>}
        {stream && <button type="button" disabled={capturing} onClick={() => void capturePhoto()} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{capturing ? 'Otimizando foto...' : 'Capturar foto'}</button>}
        <button type="button" onClick={() => { stopStream(); onCancel(); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
      </div>
    </section>
  );
}
