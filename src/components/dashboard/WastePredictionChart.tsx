import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Truck,
  Scale,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  predictFutureWasteVolumes,
  ForecastScenario,
  HistoricalWastePoint
} from '../../utils/ecoLogic.ts';

interface WastePredictionChartProps {
  historicalData?: HistoricalWastePoint[];
  className?: string;
}

export const WastePredictionChart: React.FC<WastePredictionChartProps> = ({
  historicalData,
  className = ''
}) => {
  const [forecastDays, setForecastDays] = useState<7 | 14>(7);
  const [scenario, setScenario] = useState<ForecastScenario>('baseline');
  const [showConfidenceBand, setShowConfidenceBand] = useState<boolean>(true);

  // Compute prediction model based on historical data and current scenario
  const prediction = useMemo(() => {
    return predictFutureWasteVolumes(historicalData, {
      forecastDays,
      scenario
    });
  }, [historicalData, forecastDays, scenario]);

  // Find the separator day (the last historical day) for the ReferenceLine
  const splitPoint = prediction.timeline.find(
    (pt, idx) => !pt.isForecast && prediction.timeline[idx + 1]?.isForecast
  );

  return (
    <div className={`bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm min-w-0 ${className}`}>
      {/* Top Header & Scenario Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-xl bg-sky-50 text-sky-700 shrink-0">
              <Sparkles className="w-4 h-4 text-sky-600" />
            </span>
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
              Predictive Waste Analytics
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              R² = {prediction.rSquared} Fit
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            Municipal Waste Volume Forecast (Linear Regression & Seasonality)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical projection of incoming municipal solid waste volumes based on 7-day collection trends and day-of-week demand patterns.
          </p>
        </div>

        {/* Horizon & Scenario Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon Selection */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
            <button
              type="button"
              onClick={() => setForecastDays(7)}
              className={`px-3 py-1 rounded-lg transition font-semibold ${
                forecastDays === 7
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              7-Day Horizon
            </button>
            <button
              type="button"
              onClick={() => setForecastDays(14)}
              className={`px-3 py-1 rounded-lg transition font-semibold ${
                forecastDays === 14
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              14-Day Horizon
            </button>
          </div>

          {/* Scenario Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScenario('baseline')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border transition whitespace-nowrap ${
                scenario === 'baseline'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Standard historical trend baseline"
            >
              Baseline
            </button>
            <button
              type="button"
              onClick={() => setScenario('festival_surge')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border transition whitespace-nowrap ${
                scenario === 'festival_surge'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
              }`}
              title="Holiday or festival surge modeling (+18% waste)"
            >
              Festival (+18%)
            </button>
            <button
              type="button"
              onClick={() => setScenario('segregation_drive')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border transition whitespace-nowrap ${
                scenario === 'segregation_drive'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
              title="Citizen source segregation and composting drive (-12% waste)"
            >
              Segregation (-12%)
            </button>
          </div>
        </div>
      </div>

      {/* 4 Forecast KPI Metric Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 my-4 sm:my-5">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 text-[11px] sm:text-xs font-medium">
            <span className="truncate">Forecasted Volume</span>
            <Scale className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 whitespace-nowrap">
            {prediction.totalForecastKg} kg
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {prediction.projectedGrowthPercent >= 0 ? '+' : ''}
            {prediction.projectedGrowthPercent}% vs prior period
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 text-[11px] sm:text-xs font-medium">
            <span className="truncate">Peak Day Load</span>
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 whitespace-nowrap">
            {prediction.peakForecastDay.valueKg} kg
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            Expected on {prediction.peakForecastDay.label}
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 text-[11px] sm:text-xs font-medium">
            <span className="truncate">Daily Average</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 whitespace-nowrap">
            {prediction.averageDailyForecastKg} kg/d
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            Model: {scenario.replace('_', ' ')}
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 text-[11px] sm:text-xs font-medium">
            <span className="truncate">Fleet Requirement</span>
            <Truck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 whitespace-nowrap">
            {prediction.recommendedTruckCount} Vehicles
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            Based on ~220 kg payload
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="h-64 sm:h-80 w-full min-w-0 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={prediction.timeline}
            margin={{ top: 18, right: 8, left: -14, bottom: 20 }}
          >
            <defs>
              <linearGradient id="confidenceBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-20}
              textAnchor="end"
              minTickGap={16}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              unit=" kg"
              domain={[0, 'auto']}
            />

            <Tooltip content={<CustomPredictionTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }}
            />

            {/* Split Indicator Reference Line */}
            {splitPoint && (
              <ReferenceLine
                x={splitPoint.label}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{
                  value: 'Forecast Horizon ➔',
                  position: 'insideTopRight',
                  fill: '#0284c7',
                  fontSize: 10,
                  fontWeight: 700
                }}
              />
            )}

            {/* Confidence Area Band */}
            {showConfidenceBand && (
              <Area
                type="monotone"
                dataKey="confidenceRange"
                fill="url(#confidenceBandGradient)"
                stroke="#0284c7"
                strokeWidth={1}
                strokeDasharray="2 2"
                name="Confidence Range (±10-15%)"
              />
            )}

            {/* Actual Historical Volume Bar */}
            <Bar
              dataKey="actualKg"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              name="Historical Actual (kg)"
              maxBarSize={32}
            />

            {/* Predicted Trend Line */}
            <Line
              type="monotone"
              dataKey="predictedKg"
              stroke="#0284c7"
              strokeWidth={3}
              strokeDasharray="6 6"
              dot={{
                r: 4,
                fill: '#0284c7',
                stroke: '#ffffff',
                strokeWidth: 2
              }}
              activeDot={{ r: 7, fill: '#0369a1' }}
              name="Predicted Volume (kg)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer with Contextual Recommendation & Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            {scenario === 'festival_surge'
              ? 'Festive peak forecast: Pre-allocate 1 auxiliary backup vehicle to Ward 1 & Ward 2.'
              : scenario === 'segregation_drive'
              ? 'Segregation initiative active: Expect lower wet organic landfill dumping.'
              : 'Standard trend: Collection volumes expected to peak on Saturday morning.'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowConfidenceBand(!showConfidenceBand)}
          className="text-sky-700 hover:text-sky-800 font-semibold self-start sm:self-auto cursor-pointer"
        >
          {showConfidenceBand ? 'Hide Confidence Band' : 'Show Confidence Band'}
        </button>
      </div>
    </div>
  );
};

// Custom Tooltip component for rich inspection
const CustomPredictionTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const isForecast = dataPoint.isForecast;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/80 text-xs min-w-[210px]">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <span className="font-bold text-slate-200">{label}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isForecast
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {isForecast ? 'Forecasted' : 'Historical'}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        {dataPoint.actualKg !== null && dataPoint.actualKg !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Actual Collected:
            </span>
            <span className="font-bold text-white">{dataPoint.actualKg} kg</span>
          </div>
        )}

        {dataPoint.predictedKg !== null && dataPoint.predictedKg !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              Predicted Volume:
            </span>
            <span className="font-bold text-sky-300">{dataPoint.predictedKg} kg</span>
          </div>
        )}

        {isForecast && dataPoint.confidenceLower !== null && dataPoint.confidenceUpper !== null && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-1">
            <span>Confidence Range:</span>
            <span className="font-mono text-slate-300">
              {dataPoint.confidenceLower} – {dataPoint.confidenceUpper} kg
            </span>
          </div>
        )}

        {dataPoint.requests && (
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Est. Requests:</span>
            <span className="font-semibold text-slate-200">~{Math.round(dataPoint.requests)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
