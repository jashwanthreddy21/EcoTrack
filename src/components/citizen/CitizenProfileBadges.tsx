import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  Layers,
  Leaf,
  Lock,
  Recycle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import {
  CitizenBadge,
  PickupRequest,
  User,
  UserLocationSelection
} from '../../types/index.ts';
import { evaluateCitizenGamification } from '../../utils/ecoLogic.ts';

interface CitizenProfileBadgesProps {
  currentUser: User | null;
  pickups: PickupRequest[];
  selectedLocation?: UserLocationSelection | null;
}

type BadgeFilter = 'all' | 'earned' | 'in_progress';

function getBadgeIcon(badgeId: string) {
  switch (badgeId) {
    case 'eco-warrior':
      return ShieldCheck;
    case 'recycling-pro':
      return Recycle;
    case 'segregation-master':
      return Layers;
    case 'consistent-contributor':
      return Flame;
    case 'zero-waste-guardian':
      return Leaf;
    case 'first-pickup':
    default:
      return Award;
  }
}

function getTierStyles(badge: CitizenBadge): {
  iconWrap: string;
  accentText: string;
  barFill: string;
  cardSurface: string;
} {
  if (!badge.earned) {
    return {
      iconWrap: 'bg-slate-100 text-slate-400 border border-slate-200',
      accentText: 'text-slate-600',
      barFill: 'bg-emerald-600',
      cardSurface: 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
    };
  }

  switch (badge.tier) {
    case 'emerald':
      return {
        iconWrap: 'bg-emerald-600 text-white shadow-xs',
        accentText: 'text-emerald-800',
        barFill: 'bg-emerald-600',
        cardSurface: 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
      };
    case 'gold':
      return {
        iconWrap: 'bg-amber-500 text-white shadow-xs',
        accentText: 'text-amber-900',
        barFill: 'bg-amber-500',
        cardSurface: 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
      };
    case 'silver':
      return {
        iconWrap: 'bg-sky-600 text-white shadow-xs',
        accentText: 'text-sky-900',
        barFill: 'bg-sky-600',
        cardSurface: 'bg-sky-50/50 border-sky-200 hover:border-sky-300'
      };
    case 'bronze':
    default:
      return {
        iconWrap: 'bg-teal-600 text-white shadow-xs',
        accentText: 'text-teal-900',
        barFill: 'bg-teal-600',
        cardSurface: 'bg-teal-50/50 border-teal-200 hover:border-teal-300'
      };
  }
}

function formatEarnedDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const CitizenProfileBadges: React.FC<CitizenProfileBadgesProps> = ({
  currentUser,
  pickups,
  selectedLocation
}) => {
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  const summary = useMemo(() => evaluateCitizenGamification(pickups), [pickups]);

  const filteredBadges = useMemo(() => {
    if (filter === 'earned') return summary.badges.filter((b) => b.earned);
    if (filter === 'in_progress') return summary.badges.filter((b) => !b.earned);
    return summary.badges;
  }, [summary.badges, filter]);

  const activeBadge = useMemo(
    () => summary.badges.find((b) => b.id === selectedBadgeId) || null,
    [summary.badges, selectedBadgeId]
  );

  const initials = useMemo(() => {
    const raw = (currentUser?.name || 'Citizen').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }, [currentUser?.name]);

  const locationSummary = selectedLocation
    ? `${selectedLocation.areaName} · ${selectedLocation.ward || currentUser?.ward || 'Ward 1'}`
    : `${currentUser?.area || 'Warangal Urban'} · ${currentUser?.ward || 'Ward 1'}`;

  return (
    <section
      data-testid="citizen-profile-badges"
      aria-labelledby="citizen-eco-profile-heading"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6"
    >
      {/* Citizen Profile Identity + Gamification Metrics Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-5 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-2xl bg-emerald-700 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2
                id="citizen-eco-profile-heading"
                className="text-lg font-bold text-slate-900 tracking-tight truncate"
              >
                {currentUser?.name || 'Citizen Resident'}
              </h2>
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {summary.level}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>{currentUser?.email || 'citizen@ecotrack.org'}</span>
              {currentUser?.phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{currentUser.phone}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{locationSummary}</span>
            </div>

            {summary.nextLevelName ? (
              <p className="mt-1.5 text-xs text-slate-600">
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {summary.pointsToNextLevel} pts
                </span>{' '}
                to reach <span className="font-semibold text-emerald-800">{summary.nextLevelName}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                Top municipal sustainability tier achieved
              </p>
            )}
          </div>
        </div>

        {/* Summary Numbers (Tabular Numerals) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">EcoPoints</p>
            <p
              data-testid="citizen-eco-points"
              className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5"
            >
              {summary.ecoPoints}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Badges Earned</p>
            <p
              data-testid="citizen-badges-earned-count"
              className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {summary.earnedBadgesCount}/{summary.totalBadgesCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Segregation Rate</p>
            <p
              data-testid="citizen-segregation-rate"
              className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {summary.segregationRatePercent}%
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Sorted Diverted</p>
            <p
              data-testid="citizen-diverted-kg"
              className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {summary.totalDivertedKg} kg
            </p>
          </div>
        </div>
      </div>

      {/* Filter Header */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Sustainability Badges & Milestones</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Earned automatically from verified doorstep pickups and source waste segregation
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter citizen badges"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({summary.totalBadgesCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'earned'}
            onClick={() => setFilter('earned')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'earned'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Earned ({summary.earnedBadgesCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'in_progress'}
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
              filter === 'in_progress'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            In Progress ({summary.totalBadgesCount - summary.earnedBadgesCount})
          </button>
        </div>
      </div>

      {/* Virtual Badges Grid */}
      {filteredBadges.length === 0 ? (
        <div className="mt-5 py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200/70">
          {filter === 'earned'
            ? 'No badges unlocked yet. Complete your first segregated waste pickup to earn First Green Step.'
            : 'All sustainability badges are unlocked. Keep up the great segregation habit!'}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredBadges.map((badge) => {
            const Icon = getBadgeIcon(badge.id);
            const styles = getTierStyles(badge);
            const isSelected = selectedBadgeId === badge.id;
            const earnedDateLabel = formatEarnedDate(badge.earnedAt);

            return (
              <button
                key={badge.id}
                type="button"
                data-testid={`badge-card-${badge.id}`}
                data-earned={badge.earned ? 'true' : 'false'}
                aria-expanded={isSelected}
                onClick={() => setSelectedBadgeId(isSelected ? null : badge.id)}
                className={`text-left p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${styles.cardSurface} ${
                  isSelected ? 'ring-2 ring-emerald-600/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug">
                        {badge.title}
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 mt-0.5 ${
                          badge.earned ? styles.accentText : 'text-slate-500'
                        }`}
                      >
                        {badge.earned ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Unlocked</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>Locked</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress Bar & Criteria */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
                    <span>{badge.criteriaLabel}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {badge.progressCurrent}/{badge.progressTarget} {badge.unitLabel}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${styles.barFill}`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                  {badge.earned && earnedDateLabel && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Earned on {earnedDateLabel}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Badge Details Bar */}
      {activeBadge && (
        <div
          data-testid="selected-badge-details"
          className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div>
            <p className="font-bold text-slate-900">
              {activeBadge.title} — {activeBadge.earned ? 'Badge Unlocked' : 'Milestone Progress'}
            </p>
            <p className="text-slate-600 mt-0.5">
              {activeBadge.description}{' '}
              {!activeBadge.earned && (
                <span className="font-semibold text-emerald-800">
                  Remaining: {Math.max(0, Number((activeBadge.progressTarget - activeBadge.progressCurrent).toFixed(1)))}{' '}
                  {activeBadge.unitLabel}.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBadgeId(null)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
};
