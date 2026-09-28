import { useEffect, useRef, useState } from 'react';

interface QrScannerProps {
  onDetect: (payload: string) => void;
  onClose: () => void;
}

// ক্যামেরা দিয়ে QR স্ক্যান — jsQR দিয়ে প্রতি ফ্রেম ডিকোড করা হয় (হালকা, কোনো ভারী
// dependency ছাড়া)। POS পাতায় মডাল হিসেবে ব্যবহৃত হয় (Phase18)।
export function QrScanner({ onDetect, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId: number;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch {
        setError('ক্যামেরা চালু করা যায়নি — ব্রাউজারে ক্যামেরা-অনুমতি দিন, অথবা ম্যানুয়ালি সার্চ করে যোগ করুন।');
      }
    }

    async function scanLoop() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsQR = (await import('jsqr')).default;
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data && !detectedRef.current) {
            detectedRef.current = true;
            if (navigator.vibrate) navigator.vibrate(100);
            onDetect(code.data);
            return; // detect হয়ে গেলে লুপ থামানো, onDetect-এর caller নিজে মডাল বন্ধ করবে
          }
        }
      }
      rafId = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)]">
        <video ref={videoRef} className="w-full" muted playsInline />
        <div className="pointer-events-none absolute inset-8 rounded-[var(--radius-card)] border-2 border-white/70" />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error && <p className="mt-4 max-w-sm text-center text-sm text-white">{error}</p>}
      <button onClick={onClose} className="mt-6 rounded-[var(--radius-control)] bg-white px-5 py-2 text-sm font-medium text-ink">
        বন্ধ করুন
      </button>
    </div>
  );
}
