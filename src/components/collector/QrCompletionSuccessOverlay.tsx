import React, { useEffect } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { QrSuccessFeedbackData } from '../../utils/ecoLogic.ts';

interface QrCompletionSuccessOverlayProps {
  feedback: QrSuccessFeedbackData | null;
  onDismiss: () => void;
}

export const QrCompletionSuccessOverlay: React.FC<QrCompletionSuccessOverlayProps> = ({
  feedback,
  onDismiss
}) => {
  useEffect(() => {
    if (!feedback) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  return (
    <div
      key={feedback.id}
      data-testid="qr-success-overlay"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 cursor-pointer select-none"
    >
      {/* Full-viewport green flash & soft emerald vignette */}
      <div
        data-testid="qr-success-flash"
        className="absolute inset-0 pointer-events-none qr-success-flash-anim"
        style={{
          background:
            'radial-gradient(circle at center, rgba(16, 185, 129, 0.34) 0%, rgba(5, 150, 105, 0.22) 48%, rgba(4, 120, 87, 0.14) 100%)'
        }}
      />

      {/* Subtle backdrop scrim to elevate the checkmark badge over modals or dashboards */}
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px] pointer-events-none" />

      {/* Centered Animated Checkmark Confirmation Card */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 border border-emerald-200 shadow-[0_24px_60px_-12px_rgba(5,150,105,0.38)] px-6 pt-7 pb-6 text-center overflow-hidden qr-success-card-anim"
      >
        {/* Expanding Emerald Halo + Animated SVG Checkmark */}
        <div
          data-testid="qr-success-checkmark"
          className="relative w-20 h-20 mx-auto flex items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-emerald-400/35 qr-success-halo-anim"
          />
          <div className="relative w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center shadow-inner border border-emerald-200/80">
            <svg
              viewBox="0 0 56 56"
              className="w-16 h-16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="#059669"
                strokeWidth="3.2"
                strokeLinecap="round"
                className="qr-success-circle-anim"
              />
              <path
                d="M17.5 28.8L24.6 35.8L38.8 21.2"
                stroke="#059669"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="qr-success-check-anim"
              />
            </svg>
          </div>
        </div>

        {/* Status Pill & Clear Typographic Feedback */}
        <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
          <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={3} />
          <span>QR Verified &amp; Completed</span>
        </div>

        <h3 className="mt-2.5 text-xl font-extrabold text-slate-900 tracking-tight">
          Pickup Completed
        </h3>

        <p className="mt-1 text-xs text-slate-600 font-medium">
          <span className="font-semibold text-slate-900">{feedback.citizenName}</span>
          {' · '}
          <span className="text-slate-600">{feedback.categoryName}</span>
        </p>

        {/* Monospace Reference Summary */}
        <div className="mt-4 px-3.5 py-2.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between gap-2 text-xs">
          <div className="text-left min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Container Label
            </span>
            <span className="font-mono tabular-nums font-bold text-emerald-950 truncate block">
              {feedback.containerTagId}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Verified Weight
            </span>
            <span className="font-mono tabular-nums font-extrabold text-emerald-800">
              {feedback.actualQuantityKg > 0 ? `${feedback.actualQuantityKg} kg` : 'Verified'}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400 flex items-center justify-center gap-1 font-medium">
          <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>{feedback.requestNumber} · Tap anywhere to continue</span>
        </p>

        {/* Bottom Auto-Dismiss Progress Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-100">
          <div className="h-full bg-emerald-600 qr-success-progress-anim" />
        </div>
      </div>
    </div>
  );
};
