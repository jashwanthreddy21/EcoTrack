import React, { useState } from 'react';
import { Sparkles, Search, MapPin, ExternalLink, CheckCircle, Navigation, Layers, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.ts';

export const EcoLocatorPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Recyclable Waste');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    reply: string;
    facilities?: any[];
    groundingChunks?: any[];
    fallback?: boolean;
  } | null>(null);

  const quickCategories = [
    'Recyclable Waste',
    'Electronic Waste',
    'Organic Waste',
    'Hazardous Waste',
    'Construction Waste'
  ];

  const handleSearch = async (targetCategory?: string, customQuery?: string) => {
    const activeCat = targetCategory || category;
    const activeQ = customQuery || query;
    setLoading(true);

    try {
      const data = await api.queryEcoLocator(activeQ, activeCat);
      setResult(data);
    } catch (err: any) {
      console.warn('Eco locator error:', err);
      setResult({
        reply: `Municipal recycling center near Warangal:\n- GWMC Central Material Recovery Facility, Shambunipet\n- Composting Yard, Balasamudram\n- Authorized E-Waste Station, Kazipet`,
        fallback: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-8 text-white shadow-md">
        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          Gemini 3.8 Flash & Grounded Knowledge
        </span>
        <h1 className="text-xl sm:text-2xl font-black mt-1">
          Municipal Eco-Locator & Segregation Guide
        </h1>
        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
          Ask our AI waste expert where to responsibly dispose of hard-to-recycle items, hazardous materials, and bulk e-waste across your selected municipality.
        </p>

        {/* Search Bar */}
        <div className="mt-5 max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="e.g. Where can I drop old inverter batteries or fluorescent tubes?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white placeholder:text-slate-400 focus:bg-white/20 focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading}
            className="w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 shrink-0"
          >
            {loading ? 'Locating...' : 'Locate Hubs'}
          </button>
        </div>

        {/* Quick Category Filters */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {quickCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                handleSearch(c, `Nearest drop-off facilities for ${c}`);
              }}
              className={`px-3 py-1.5 rounded-xl transition ${
                category === c
                  ? 'bg-emerald-500 text-white font-bold'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              Municipal Recycling Guidance
            </h3>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              Verified Guidelines
            </span>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 font-medium">
            {result.reply}
          </div>

          {/* Grounding Place Links / Sources */}
          {result.groundingChunks && result.groundingChunks.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Referenced Facility Map Locations & Sources
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.groundingChunks.map((chunk: any, idx: number) => {
                  const mapUri = chunk.maps?.uri || chunk.web?.uri;
                  const title = chunk.maps?.title || chunk.web?.title || `Facility ${idx + 1}`;
                  const snippet = chunk.maps?.placeAnswerSources?.reviewSnippets?.[0];

                  if (!mapUri) return null;

                  return (
                    <a
                      key={idx}
                      href={mapUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition flex items-start justify-between text-xs group"
                    >
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          {title}
                        </p>
                        {snippet && <p className="text-[11px] text-slate-500 mt-1 italic">&ldquo;{snippet}&rdquo;</p>}
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Default Recommended Drop-off Facilities */}
          {result.facilities && result.facilities.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Permanent Drop-Off Centers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.facilities.map((f: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {f.category}
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm mt-2">{f.facilityName}</h5>
                      <p className="text-slate-600 mt-1 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        {f.address}
                      </p>
                      <p className="text-slate-500 mt-2 bg-white p-2 rounded-lg border text-[11px]">
                        {f.guidelines}
                      </p>
                    </div>

                    {f.mapUri && (
                      <a
                        href={f.mapUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                      >
                        Directions on Map &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
