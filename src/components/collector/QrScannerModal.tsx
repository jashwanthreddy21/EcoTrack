import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { PickupRequest } from '../../types/index.ts';
import {
  generateContainerTagId,
  isQrCompletableStatus,
  resolvePickupFromQrScan,
  buildAutoQrCompletionPayload
} from '../../utils/ecoLogic.ts';
import {
  Camera,
  CheckCircle2,
  FileUp,
  Keyboard,
  QrCode,
  Scale,
  AlertCircle,
  X,
  RotateCcw,
  ScanLine,
  Loader2
} from 'lucide-react';

type ScannerTab = 'camera' | 'image' | 'manual';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectorId: string;
  collectorName?: string;
  assignedPickups: PickupRequest[];
  targetPickup?: PickupRequest | null;
  autoVerifyOnScan?: boolean;
  onVerifyQrCompletion: (
    pickupId: string,
    payload: {
      scannedCode: string;
      actualQuantityKg: number;
      completionRemarks?: string;
    }
  ) => Promise<PickupRequest>;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  collectorId,
  assignedPickups,
  targetPickup,
  autoVerifyOnScan = true,
  onVerifyQrCompletion
}) => {
  const [activeTab, setActiveTab] = useState<ScannerTab>('camera');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'unavailable'>('idle');
  const [cameraMessage, setCameraMessage] = useState<string>('');
  const [cameraRetryNonce, setCameraRetryNonce] = useState<number>(0);
  const [manualCode, setManualCode] = useState<string>('');
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');

  // Matched container state
  const [matchedPickup, setMatchedPickup] = useState<PickupRequest | null>(null);
  const [verifiedScannedCode, setVerifiedScannedCode] = useState<string>('');
  const [verifiedContainerTag, setVerifiedContainerTag] = useState<string>('');
  const [actualKg, setActualKg] = useState<number>(10);
  const [completionRemarks, setCompletionRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState<boolean>(false);
  const [completedPickup, setCompletedPickup] = useState<PickupRequest | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingScanRef = useRef<boolean>(false);

  const stopCamera = () => {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Reset modal cleanly when opened/closed or targetPickup changes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      isProcessingScanRef.current = false;
      setIsAutoVerifying(false);
      setIsSubmitting(false);
      return;
    }

    isProcessingScanRef.current = false;
    setScanError('');
    setManualCode('');
    setUploadedPreviewUrl('');
    setMatchedPickup(null);
    setVerifiedScannedCode('');
    setVerifiedContainerTag('');
    setCompletedPickup(null);
    setCompletionRemarks('');
    setIsAutoVerifying(false);
    setIsSubmitting(false);
    setActiveTab('camera');
  }, [isOpen, targetPickup?.id]);

  const handleDecodedQrPayload = async (rawText: string): Promise<boolean> => {
    if (isProcessingScanRef.current) {
      return false;
    }

    setScanError('');
    const result = resolvePickupFromQrScan(
      rawText,
      assignedPickups,
      collectorId,
      targetPickup?.id
    );

    if (!result.matched || !result.pickup) {
      setScanError(result.error || 'Could not verify scanned waste container label.');
      return false;
    }

    isProcessingScanRef.current = true;
    stopCamera();

    const resolvedTag = (
      result.containerTagId ||
      result.pickup.containerTagId ||
      generateContainerTagId(result.pickup.requestNumber, result.pickup.categoryName)
    ).toUpperCase();

    const autoPayload = buildAutoQrCompletionPayload(result.pickup, result.parsedCode, resolvedTag);

    setVerifiedScannedCode(autoPayload.scannedCode);
    setVerifiedContainerTag(resolvedTag);
    setActualKg(autoPayload.actualQuantityKg);
    setCompletionRemarks('');

    if (autoVerifyOnScan) {
      setIsAutoVerifying(true);
      setIsSubmitting(true);
      try {
        const updated = await onVerifyQrCompletion(result.pickup.id, autoPayload);
        setCompletedPickup(updated);
        setMatchedPickup(null);
      } catch (err: any) {
        setScanError(err?.message || 'Failed to verify and complete pickup.');
        setMatchedPickup(result.pickup);
        isProcessingScanRef.current = false;
      } finally {
        setIsAutoVerifying(false);
        setIsSubmitting(false);
      }
      return true;
    }

    setMatchedPickup(result.pickup);
    return true;
  };

  // Start / stop live webcam QR scanning
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || matchedPickup || completedPickup || isAutoVerifying) {
      stopCamera();
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unavailable');
        setCameraMessage('Camera API is not available in this browser. Upload a QR label photo or enter the container code.');
        return;
      }

      setCameraState('starting');
      setCameraMessage('');

      try {
        if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (cancelled) return;
          const hasVideoInput = devices.some((d) => d.kind === 'videoinput');
          if (!hasVideoInput) {
            setCameraState('unavailable');
            setCameraMessage(
              'No camera device was detected on this browser. Upload a container QR photo or enter the label code instead.'
            );
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('active');

        const scanFrame = async () => {
          if (cancelled || isProcessingScanRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            const scale = Math.min(1, 480 / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth'
              });
              if (decoded && decoded.data) {
                const matched = await handleDecodedQrPayload(decoded.data);
                if (matched) return;
              }
            }
          }

          if (!cancelled) {
            scanTimerRef.current = window.setTimeout(scanFrame, 220);
          }
        };

        scanTimerRef.current = window.setTimeout(scanFrame, 220);
      } catch {
        if (!cancelled) {
          setCameraState('unavailable');
          setCameraMessage(
            'Camera access was blocked or no camera device was detected. Upload a container QR photo or enter the label code instead.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, activeTab, matchedPickup, completedPickup, isAutoVerifying, cameraRetryNonce]);

  if (!isOpen) return null;

  const completablePickups = assignedPickups.filter((p) => isQrCompletableStatus(p.status));

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setScanError('Could not read the selected image file.');
        return;
      }
      setUploadedPreviewUrl(dataUrl);

      const img = new Image();
      img.onload = () => {
        const rawW = img.naturalWidth || img.width;
        const rawH = img.naturalHeight || img.height;
        const scale = rawW > 800 ? 800 / rawW : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rawW * scale));
        canvas.height = Math.max(1, Math.round(rawH * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setScanError('Canvas decoding is unavailable in this browser.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (!decoded || !decoded.data) {
          setScanError('No readable QR code was found in that image. Ensure the container sticker is sharp and well-lit.');
          return;
        }

        handleDecodedQrPayload(decoded.data);
      };
      img.onerror = () => {
        setScanError('Failed to decode the uploaded image file.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDecodedQrPayload(manualCode);
  };

  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedPickup) return;

    setIsSubmitting(true);
    setScanError('');
    try {
      const updated = await onVerifyQrCompletion(matchedPickup.id, {
        scannedCode: verifiedScannedCode,
        actualQuantityKg: Number(actualKg),
        completionRemarks:
          completionRemarks.trim() ||
          `Container label ${verifiedContainerTag} verified via QR scan and weighed at collection point.`
      });
      setCompletedPickup(updated);
      setMatchedPickup(null);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to verify and complete pickup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetScanner = () => {
    isProcessingScanRef.current = false;
    setIsAutoVerifying(false);
    setIsSubmitting(false);
    setMatchedPickup(null);
    setCompletedPickup(null);
    setScanError('');
    setManualCode('');
    setUploadedPreviewUrl('');
    setVerifiedScannedCode('');
    setVerifiedContainerTag('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-modal-title"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 gap-3">
          <div>
            <h3 id="qr-scanner-modal-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Container QR Pickup Verification</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetPickup
                ? `Scan the label on ${targetPickup.requestNumber} (${targetPickup.containerTagId || generateContainerTagId(targetPickup.requestNumber, targetPickup.categoryName)}) to confirm collection.`
                : 'Scan the QR label on a citizen waste container to verify and complete the pickup.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR scanner"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error feedback banner */}
        {scanError && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{scanError}</span>
          </div>
        )}

        {/* STATE 2A: Automatic QR Verification In Progress */}
        {isAutoVerifying ? (
          <div className="mt-5 py-8 px-4 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Verifying Scanned Container</h4>
              <p className="text-xs text-slate-600 mt-1">
                Recording pickup completion for{' '}
                <span className="font-mono tabular-nums font-bold text-emerald-800">
                  {verifiedContainerTag}
                </span>
                ...
              </p>
            </div>
          </div>
        ) : completedPickup ? (
          <div className="mt-5 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Pickup QR-Verified &amp; Completed</h4>
              <p className="text-xs text-slate-600 mt-1">
                {completedPickup.requestNumber} &middot;{' '}
                <span className="font-mono tabular-nums font-semibold">
                  {completedPickup.containerTagId || verifiedContainerTag}
                </span>
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Citizen</span>
                <span className="font-bold text-slate-900">{completedPickup.citizenName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Weighed Quantity</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  {completedPickup.actualQuantityKg} kg
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verified Timestamp</span>
                <span className="font-mono tabular-nums text-slate-700">
                  {completedPickup.qrVerifiedAt
                    ? new Date(completedPickup.qrVerifiedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Just now'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              {!targetPickup && completablePickups.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Scan Next Container</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition whitespace-nowrap"
              >
                Done
              </button>
            </div>
          </div>
        ) : matchedPickup ? (
          /* STATE 2: Matched Container Weigh-In & Final Completion */
          <form onSubmit={handleConfirmCompletion} className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>QR Label Verified</span>
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-900">
                  {verifiedContainerTag}
                </span>
              </div>
              <div className="pt-2 border-t border-emerald-200/70 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {matchedPickup.requestNumber} &middot; {matchedPickup.citizenName}
                </p>
                <p className="text-slate-600">
                  {matchedPickup.address} ({matchedPickup.ward})
                </p>
                <p className="text-slate-600">
                  Stream: <span className="font-semibold text-slate-800">{matchedPickup.categoryName}</span> &middot;
                  Est. <span className="font-mono tabular-nums">{matchedPickup.quantityKg} kg</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="qr-actual-kg" className="block font-bold text-slate-700 mb-1">
                  Actual Weighed Quantity (kg) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Scale className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="qr-actual-kg"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1000"
                    value={actualKg}
                    onChange={(e) => setActualKg(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-mono tabular-nums font-bold text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="qr-completion-remarks" className="block font-bold text-slate-700 mb-1">
                  Collector Remarks
                </label>
                <textarea
                  id="qr-completion-remarks"
                  rows={2}
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  placeholder="Optional inspection note (e.g. Segregated wet waste collected and bin sanitized)."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetScanner}
                className="px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition whitespace-nowrap"
              >
                Scan Different Bin
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition whitespace-nowrap disabled:opacity-60"
              >
                {isSubmitting ? 'Completing...' : 'Verify & Complete Pickup'}
              </button>
            </div>
          </form>
        ) : (
          /* STATE 1: QR Code Capture (Camera / Image Upload / Manual Label Entry) */
          <div className="mt-4 space-y-4">
            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl" role="tablist" aria-label="QR Scan Method">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'camera'}
                onClick={() => {
                  setScanError('');
                  setActiveTab('camera');
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'camera'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>Live Camera</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'image'}
                onClick={() => {
                  setScanError('');
                  setActiveTab('image');
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'image'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-3.5 h-3.5 shrink-0" />
                <span>Label Image</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'manual'}
                onClick={() => {
                  setScanError('');
                  setActiveTab('manual');
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>Label Code</span>
              </button>
            </div>

            {/* Tab 1: Live Camera Scanner */}
            {activeTab === 'camera' && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center border border-slate-200">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {cameraState === 'active' && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] flex items-center justify-center">
                        <ScanLine className="w-8 h-8 text-emerald-300 opacity-80" />
                      </div>
                    </div>
                  )}

                  {cameraState === 'starting' && (
                    <div className="text-center p-6 text-slate-300 text-xs space-y-2">
                      <Camera className="w-8 h-8 mx-auto text-emerald-400 animate-pulse" />
                      <p className="font-semibold">Initializing device camera...</p>
                    </div>
                  )}

                  {cameraState === 'unavailable' && (
                    <div className="text-center p-6 max-w-xs space-y-3">
                      <Camera className="w-8 h-8 mx-auto text-slate-400" />
                      <p className="text-xs text-slate-200 leading-relaxed">{cameraMessage}</p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('image')}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition whitespace-nowrap"
                        >
                          Upload QR Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('manual')}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition whitespace-nowrap"
                        >
                          Enter Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setCameraRetryNonce((n) => n + 1)}
                          className="px-3 py-2 rounded-xl border border-slate-600 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition whitespace-nowrap"
                        >
                          Retry Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  Point your rear camera at the waste container&apos;s EcoTrack QR sticker for instant verification.
                </p>
              </div>
            )}

            {/* Tab 2: Upload Container QR Image */}
            {activeTab === 'image' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  id="qr-image-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="sr-only"
                />
                <label
                  htmlFor="qr-image-upload-input"
                  className="block border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/40 transition"
                >
                  {uploadedPreviewUrl ? (
                    <img
                      src={uploadedPreviewUrl}
                      alt="Uploaded container QR label preview"
                      className="w-36 h-36 mx-auto object-contain rounded-xl border border-slate-200 bg-white p-2 mb-3"
                    />
                  ) : (
                    <FileUp className="w-8 h-8 mx-auto text-emerald-700 mb-2" />
                  )}
                  <span className="block text-xs font-bold text-slate-800">
                    {uploadedPreviewUrl ? 'Choose a Different QR Label Image' : 'Select Container QR Label Image (PNG / JPG)'}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1">
                    Automatically decodes EcoTrack waste bin QR stickers from your device.
                  </span>
                </label>
              </div>
            )}

            {/* Tab 3: Handheld Scanner / Container Label Code */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label htmlFor="qr-manual-code-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Container Label Code or Request ID
                  </label>
                  <input
                    id="qr-manual-code-input"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG or BIN-1011-ORG"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports USB/Bluetooth barcode guns, full QR payloads, container tags (<span className="font-mono">BIN-1011-ORG</span>), or request IDs.
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition whitespace-nowrap"
                >
                  Verify Container Label
                </button>
              </form>
            )}

            {/* Assigned active containers reference list */}
            {completablePickups.length > 0 && !targetPickup && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500">
                  Active containers on your shift ({completablePickups.length})
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {completablePickups.map((p) => {
                    const tag = p.containerTagId || generateContainerTagId(p.requestNumber, p.categoryName);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block truncate">{p.citizenName}</span>
                          <span className="text-[11px] text-slate-500">
                            {p.requestNumber} &middot; {p.categoryName}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-slate-700 shrink-0 ml-2">
                          {tag}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
