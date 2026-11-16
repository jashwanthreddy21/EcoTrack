import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PickupRequest } from '../../types/index.ts';
import { buildContainerQrPayload, generateContainerTagId } from '../../utils/ecoLogic.ts';
import { X, Download, Copy, Check, QrCode, Printer } from 'lucide-react';

interface ContainerQrLabelModalProps {
  pickup: PickupRequest | null;
  onClose: () => void;
  onScanThisContainer?: (pickup: PickupRequest) => void;
}

export const ContainerQrLabelModal: React.FC<ContainerQrLabelModalProps> = ({
  pickup,
  onClose,
  onScanThisContainer
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const containerTagId = pickup
    ? pickup.containerTagId || generateContainerTagId(pickup.requestNumber, pickup.categoryName)
    : '';
  const payload = pickup ? buildContainerQrPayload({ ...pickup, containerTagId }) : '';

  useEffect(() => {
    if (!payload) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!pickup) return null;

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `ecotrack-${containerTagId.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="container-qr-label-title"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-700" />
            <h3 id="container-qr-label-title" className="text-base sm:text-lg font-bold text-slate-900">
              Waste Container QR Label
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close container label modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 text-center space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200 pb-2.5">
            <span className="font-bold text-slate-900">{pickup.requestNumber}</span>
            <span className="font-mono tabular-nums font-bold text-emerald-800">{containerTagId}</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-flex items-center justify-center mx-auto">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code for container ${containerTagId}`}
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                Generating QR label...
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-900">{pickup.citizenName}</p>
            <p>{pickup.address}</p>
            <p className="text-slate-500">
              {pickup.categoryName} &middot; {pickup.ward} &middot; Est.{' '}
              <span className="font-mono tabular-nums font-semibold">{pickup.quantityKg} kg</span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2 border">
            <code className="text-[11px] font-mono tabular-nums text-slate-700 truncate">{payload}</code>
            <button
              type="button"
              onClick={handleCopyPayload}
              aria-label="Copy container QR payload"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label</span>
          </button>

          {onScanThisContainer && pickup.status !== 'Completed' && (
            <button
              type="button"
              onClick={() => onScanThisContainer(pickup)}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <QrCode className="w-4 h-4" />
              <span>Verify This Bin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
