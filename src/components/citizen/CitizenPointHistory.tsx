import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Leaf,
  QrCode,
  Scale,
  Search,
  ArrowUpRight
} from 'lucide-react';
import {
  CitizenPointHistoryEntry,
  PickupRequest,
  PointActivityType
} from '../../types/index.ts';
import { evaluateCitizenGamification } from '../../utils/ecoLogic.ts';

interface CitizenPointHistoryProps {
  pickups: PickupRequest[];
  onSelectPickup: (pickup: PickupRequest) => void;
  onNavigate: (screen: any) => void;
  onOpenRequestModal: () => void;
}

type ActivityFilter = 'all' | 'pickups' | 'segregation' | 'bonuses';

const INITIAL_VISIBLE_ROWS = 6;

function getActivityIcon(type: PointActivityType) {
  switch (type) {
    case 'segregation_bonus':
      return Leaf;
    case 'qr_verified':
      return QrCode;
    case 'weight_diverted':
      return Scale;
    case 'pickup_completed':
    default:
      return CheckCircle2;
  }
}

function getActivityIconTone(type: PointActivityType): string {
  switch (type) {
    case 'segregation_bonus':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
    case 'qr_verified':
      return 'bg-sky-50 text-sky-700 border-sky-200/70';
    case 'weight_diverted':
      return 'bg-amber-50 text-amber-700 border-amber-200/70';
    case 'pickup_completed':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200/80';
  }
}

function formatAwardTimestamp(iso?: string): string {
  if (!iso) return 'Recorded on completion';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Recorded on completion';
  const datePart = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart} · ${timePart}`;
}

export const CitizenPointHistory: React.FC<CitizenPointHistoryProps> = ({
  pickups,
  onSelectPickup,
  onNavigate,
  onOpenRequestModal
}) => {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => evaluateCitizenGamification(pickups), [pickups]);

  const pickupMap = useMemo(() => {
    const map = new Map<string, PickupRequest>();
    for (const p of pickups) {
      map.set(p.id, p);
    }
    return map;
  }, [pickups]);

  const counts = useMemo(() => {
    const all = summary.pointHistory.length;
    const pickupCount = summary.pointHistory.filter((e) => e.type === 'pickup_completed').length;
    const segCount = summary.pointHistory.filter((e) => e.type === 'segregation_bonus').length;
    const bonusCount = summary.pointHistory.filter(
      (e) => e.type === 'qr_verified' || e.type === 'weight_diverted'
    ).length;
    return { all, pickupCount, segCount, bonusCount };
  }, [summary.pointHistory]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.pointHistory.filter((entry) => {
      if (filter === 'pickups' && entry.type !== 'pickup_completed') return false;
      if (filter === 'segregation' && entry.type !== 'segregation_bonus') return false;
      if (
        filter === 'bonuses' &&
        entry.type !== 'qr_verified' &&
        entry.type !== 'weight_diverted'
      ) {
        return false;
      }

      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.reason.toLowerCase().includes(q) ||
        entry.requestNumber.toLowerCase().includes(q) ||
        entry.categoryName.toLowerCase().includes(q)
      );
    });
  }, [summary.pointHistory, filter, query]);

  const visibleEntries = useMemo(() => {
    if (showAll) return filteredEntries;
    return filteredEntries.slice(0, INITIAL_VISIBLE_ROWS);
  }, [filteredEntries, showAll]);

  const filteredPointsSubtotal = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + entry.points, 0),
    [filteredEntries]
  );

  const handleResetFilters = () => {
    setFilter('all');
    setQuery('');
    setShowAll(false);
  };

  const handleInspectPickup = (entry: CitizenPointHistoryEntry) => {
    const matched = pickupMap.get(entry.pickupId);
    if (!matched) return;
    onSelectPickup(matched);
    onNavigate('tracking');
  };

  return (
    <section
      data-testid="citizen-point-history"
      aria-labelledby="citizen-point-history-heading"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6"
    >
      {/* Header & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3
            id="citizen-point-history-heading"
            className="text-base font-bold text-slate-900 tracking-tight"
          >
            Point History
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual activity logs detailing when and why EcoPoints were awarded (25 pts pickup · 15 pts segregation · 10 pts QR · 2 pts/kg diverted)
          </p>
        </div>

        <div className="flex items-center gap-4 text-right shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Logged Total</p>
            <p
              data-testid="point-history-total-points"
              className="text-lg font-bold text-emerald-700 font-mono tabular-nums"
            >
              +{filteredPointsSubtotal} pts
            </p>
          </div>
          <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Activity Logs</p>
            <p
              data-testid="point-history-count"
              className="text-lg font-bold text-slate-900 font-mono tabular-nums"
            >
              {filteredEntries.length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Controls & Search */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter point history activity"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => {
              setFilter('all');
              setShowAll(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'pickups'}
            onClick={() => {
              setFilter('pickups');
              setShowAll(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'pickups'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pickups ({counts.pickupCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'segregation'}
            onClick={() => {
              setFilter('segregation');
              setShowAll(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'segregation'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Segregation ({counts.segCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'bonuses'}
            onClick={() => {
              setFilter('bonuses');
              setShowAll(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'bonuses'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            QR &amp; Weight ({counts.bonusCount})
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search
            aria-hidden="true"
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAll(false);
            }}
            aria-label="Search point history"
            placeholder="Search request # or stream..."
            className="w-full pl-8 pr-3 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden transition"
          />
        </div>
      </div>

      {/* Activity Ledger Rows */}
      {summary.pointHistory.length === 0 ? (
        <div
          data-testid="point-history-empty"
          className="mt-5 py-8 px-4 text-center rounded-xl bg-slate-50/80 border border-slate-200/70"
        >
          <p className="text-sm font-semibold text-slate-800">No EcoPoints activity recorded yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Your point awards will appear here with timestamps and breakdowns as soon as your first household waste collection is completed.
          </p>
          <button
            type="button"
            onClick={onOpenRequestModal}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
          >
            Request Waste Pickup
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div
          data-testid="point-history-filtered-empty"
          className="mt-5 py-7 px-4 text-center rounded-xl bg-slate-50/80 border border-slate-200/70"
        >
          <p className="text-xs font-semibold text-slate-700">
            No point activity logs match your current filter or search.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition whitespace-nowrap shrink-0"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <ul className="divide-y divide-slate-100" aria-label="Citizen EcoPoints activity ledger">
            {visibleEntries.map((entry) => {
              const Icon = getActivityIcon(entry.type);
              const toneClass = getActivityIconTone(entry.type);
              const hasLinkedPickup = pickupMap.has(entry.pickupId);

              return (
                <li
                  key={entry.id}
                  data-testid="point-history-row"
                  data-activity-type={entry.type}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      aria-hidden="true"
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${toneClass}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-snug">
                        {entry.title}:{' '}
                        <span className="text-emerald-700 font-mono tabular-nums">
                          +{entry.points} points
                        </span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          {entry.requestNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.categoryName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.reason}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0 shrink-0">
                    <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {formatAwardTimestamp(entry.awardedAt)}
                    </span>

                    <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums min-w-[68px] text-right whitespace-nowrap">
                      +{entry.points} pts
                    </span>

                    {hasLinkedPickup && (
                      <button
                        type="button"
                        onClick={() => handleInspectPickup(entry)}
                        aria-label={`Inspect pickup ${entry.requestNumber}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition shrink-0"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {filteredEntries.length > INITIAL_VISIBLE_ROWS && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-mono tabular-nums">
                Showing {visibleEntries.length} of {filteredEntries.length} entries
              </span>
              <button
                type="button"
                data-testid="point-history-toggle-all"
                onClick={() => setShowAll((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition whitespace-nowrap shrink-0"
              >
                {showAll
                  ? 'Show Fewer'
                  : `Show All (${filteredEntries.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
