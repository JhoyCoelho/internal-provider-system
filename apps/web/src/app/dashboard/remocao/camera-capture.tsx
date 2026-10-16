'use client';

import { useEffect, useRef, useState } from 'react';

type CameraCaptureProps = {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
};

const maxImageBytes = 700 * 1024;
type CameraPermissionState = PermissionState | 'unknown';

function cameraErrorName(error: unknown) {
  return error instanceof Error ? error.name : '';
}

function cameraPermissionInstructions() {
  const userAgent = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(userAgent);
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : 'navegador';

  if (isIOS) {
    const iosBrowser = /CriOS/.test(userAgent) ? 'Chrome' : /FxiOS/.test(userAgent) ? 'Firefox' : /EdgiOS/.test(userAgent) ? 'Edge' : 'Safari';
    return `No iPhone ou iPad, abra Ajustes > Privacidade e Segurança > Câmera e habilite ${iosBrowser}. No Safari, confira também aA > Ajustes do Site > Câmera > Permitir.`;
  }
  if (isAndroid) {
    return `No ${browser}, toque no ícone à esquerda do endereço do site e permita Câmera. Se continuar bloqueado, abra Configurações do Android > Apps > ${browser} > Permissões > Câmera e habilite o acesso.`;
  }
  return `No ${browser}, abra as permissões do site pelo ícone à esquerda do endereço, altere Câmera para Permitir e volte a esta tela.`;
}

function cameraErrorMessage(error: unknown) {
  switch (cameraErrorName(error)) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Não encontramos uma câmera disponível neste dispositivo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'A câmera está sendo usada por outro aplicativo ou não respondeu. Feche outros apps que usam a câmera e tente novamente.';
    case 'OverconstrainedError':
      return 'Não foi possível iniciar a câmera com as configurações deste dispositivo. Tente novamente.';
    default:
      return 'Não foi possível iniciar a câmera. Verifique se ela está conectada e tente novamente.';
  }
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('unknown');

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {
        if (mountedRef.current) setError('Não foi possível exibir a prévia. Feche outros apps que usam a câmera e tente novamente.');
      });
    }
  }, [stream]);

  useEffect(() => {
    let active = true;
    let permissionStatus: PermissionStatus | null = null;
    mountedRef.current = true;
    const updatePermission = (status: PermissionStatus) => {
      setPermissionState(status.state);
      if (status.state !== 'denied') setError(null);
    };
    const handlePermissionChange = () => {
      if (active && permissionStatus) updatePermission(permissionStatus);
    };

    if (!window.isSecureContext) {
      setError('A câmera só funciona em uma conexão segura. Abra o sistema pelo endereço HTTPS; em desenvolvimento, use localhost.');
    } else if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: 'camera' as PermissionName }).then((status) => {
        if (!active) return;
        permissionStatus = status;
        updatePermission(status);
        status.addEventListener('change', handlePermissionChange);
      }).catch(() => {});
    }

    return () => {
      active = false;
      mountedRef.current = false;
      permissionStatus?.removeEventListener('change', handlePermissionChange);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    setStarting(true);
    setError(null);
    try {
      if (!window.isSecureContext) {
        setError('A câmera só funciona em uma conexão segura. Abra o sistema pelo endereço HTTPS; em desenvolvimento, use localhost.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não oferece acesso à câmera. Abra o sistema em um navegador atualizado.');
        return;
      }

      let cameraStream: MediaStream;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        });
      } catch (cameraError) {
        if (cameraErrorName(cameraError) !== 'OverconstrainedError') throw cameraError;
        cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (!mountedRef.current) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = cameraStream;
      setPermissionState('granted');
      setStream(cameraStream);
    } catch (cameraError) {
      if (!mountedRef.current) return;
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(cameraErrorName(cameraError)) && window.isSecureContext) {
        setPermissionState('denied');
      } else {
        setError(cameraErrorMessage(cameraError));
      }
    } finally {
      if (mountedRef.current) setStarting(false);
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
      {stream ? <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] w-full rounded-lg bg-slate-950 object-contain" /> : <p className="text-sm text-slate-600">Toque em Ativar câmera. Na primeira vez, escolha Permitir no aviso do navegador.</p>}
      {permissionState === 'denied' && <div role="status" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">A câmera está bloqueada para este site</p><p>{cameraPermissionInstructions()}</p><p>Depois de alterar a permissão, volte aqui e toque em “Já permiti, tentar novamente”.</p></div>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!stream && <button type="button" disabled={starting} onClick={() => void startCamera()} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{starting ? 'Abrindo câmera...' : permissionState === 'denied' ? 'Já permiti, tentar novamente' : 'Ativar câmera'}</button>}
        {stream && <button type="button" disabled={capturing} onClick={() => void capturePhoto()} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{capturing ? 'Otimizando foto...' : 'Capturar foto'}</button>}
        <button type="button" onClick={() => { stopStream(); onCancel(); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
      </div>
    </section>
  );
}
