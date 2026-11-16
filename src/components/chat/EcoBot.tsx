import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Trash2,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Minimize2
} from 'lucide-react';
import { ChatMessage, BotActionBadge, UserLocationSelection, UserRole } from '../../types/index.ts';
import { api } from '../../services/api.ts';

interface EcoBotProps {
  currentUserRole?: UserRole;
  currentUserId?: string;
  currentLocation: UserLocationSelection | null;
  onNavigate: (screen: string, payload?: any) => void;
  onRequestPickup: () => void;
  onChangeLocation: () => void;
}

export const EcoBot: React.FC<EcoBotProps> = ({
  currentUserRole = 'citizen',
  currentUserId,
  currentLocation,
  onNavigate,
  onRequestPickup,
  onChangeLocation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'te' | 'hi'>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [hasUnread, setHasUnread] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or restore session
  useEffect(() => {
    const existingSession = localStorage.getItem('ecotrack_chat_session_id');
    const sid = existingSession || `ecotrack-session-${Date.now()}`;
    setSessionId(sid);
    localStorage.setItem('ecotrack_chat_session_id', sid);

    // Initial greeting if empty
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg-welcome-init',
          sessionId: sid,
          role: 'assistant',
          text: getWelcomeMessage('en', currentLocation?.areaName),
          timestamp: new Date().toISOString(),
          language: 'en',
          actions: [
            { type: 'REQUEST_PICKUP', label: 'Schedule Pickup Request' },
            { type: 'TRACK', label: 'Track Active Pickup' },
            { type: 'CHANGE_LOCATION', label: 'Change Service Locality' }
          ]
        }
      ]);
    }
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Update greeting when language changes
  const handleLanguageChange = (newLang: 'en' | 'te' | 'hi') => {
    setLanguage(newLang);
    const greetingText = getWelcomeMessage(newLang, currentLocation?.areaName);
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-lang-${Date.now()}`,
        sessionId,
        role: 'assistant',
        text: greetingText,
        timestamp: new Date().toISOString(),
        language: newLang,
        actions: [
          {
            type: 'REQUEST_PICKUP',
            label:
              newLang === 'te'
                ? 'పికప్ షెడ్యూల్ చేయండి'
                : newLang === 'hi'
                ? 'पिकअप शेड्यूल करें'
                : 'Schedule Pickup Request'
          },
          {
            type: 'TRACK',
            label:
              newLang === 'te'
                ? 'పికప్ ట్రాక్ చేయండి'
                : newLang === 'hi'
                ? 'पिकअप ट्रैक करें'
                : 'Track Active Pickup'
          }
        ]
      }
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    setInputMessage('');
    setIsSending(true);

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sessionId,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
      language
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await api.sendChatMessage({
        message: text,
        sessionId,
        language,
        userId: currentUserId,
        userRole: currentUserRole,
        userLocation: currentLocation
      });

      const assistantMsg: ChatMessage = {
        id: response.messageId || `ast-${Date.now()}`,
        sessionId,
        role: 'assistant',
        text: response.reply,
        timestamp: response.timestamp || new Date().toISOString(),
        language,
        actions: response.actions
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('EcoBot response notice, displaying client fallback:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          sessionId,
          role: 'assistant',
          text:
            language === 'te'
              ? 'క్షమించండి, సర్వర్ స్పందించడంలో ఆలస్యమైంది. దయచేసి మళ్లీ ప్రయత్నించండి లేదా పికప్ షెడ్యూల్ బటన్ ఉపయోగించండి.'
              : language === 'hi'
              ? 'क्षमा करें, सर्वर से प्रतिक्रिया में देरी हुई। कृपया पुनः प्रयास करें।'
              : 'Our municipal support server is busy. You can use the direct action buttons below to manage your pickups.',
          timestamp: new Date().toISOString(),
          language,
          actions: [
            { type: 'REQUEST_PICKUP', label: 'Schedule Pickup' },
            { type: 'CHANGE_LOCATION', label: 'Change Location' }
          ]
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    setConfirmClear(false);
    try {
      if (sessionId) {
        await api.clearChatSession(sessionId);
      }
    } catch (err) {
      console.warn('Clear session notice:', err);
    }
    const newSid = `ecotrack-session-${Date.now()}`;
    setSessionId(newSid);
    localStorage.setItem('ecotrack_chat_session_id', newSid);
    setMessages([
      {
        id: `msg-init-${Date.now()}`,
        sessionId: newSid,
        role: 'assistant',
        text: getWelcomeMessage(language, currentLocation?.areaName),
        timestamp: new Date().toISOString(),
        language,
        actions: [
          { type: 'REQUEST_PICKUP', label: 'Schedule Pickup Request' },
          { type: 'TRACK', label: 'Track Active Pickup' }
        ]
      }
    ]);
  };

  const handleActionBadgeClick = (badge: BotActionBadge) => {
    if (badge.type === 'REQUEST_PICKUP') {
      onRequestPickup();
    } else if (badge.type === 'TRACK') {
      onNavigate('tracking', { pickupId: badge.payload });
    } else if (badge.type === 'REPORT_MISSED') {
      onNavigate('pickups', { missedRequestId: badge.payload });
    } else if (badge.type === 'CHANGE_LOCATION') {
      onChangeLocation();
    } else if (badge.type === 'NAVIGATE') {
      onNavigate(badge.screen || 'citizen-dashboard');
    } else if (badge.type === 'RECYCLING_GUIDE') {
      onNavigate('locator');
    }
  };

  const getQuickQuestions = () => {
    if (language === 'te') {
      return [
        'చెత్తను ఎలా విభజించాలి?',
        'నా పికప్ స్థితి ఏమిటి?',
        'చెత్త సేకరణ సమయాలు ఎప్పుడు?',
        'లొకేషన్ మార్చడం ఎలా?'
      ];
    }
    if (language === 'hi') {
      return [
        'गीला और सूखा कचरा कैसे अलग करें?',
        'मेरी पिकअप स्थिति क्या है?',
        'कचरा संग्रहण का समय क्या है?',
        'सेवा क्षेत्र कैसे बदलें?'
      ];
    }
    return [
      'How do I segregate plastic & food waste?',
      'Track my active pickup request',
      'When is my next collection shift?',
      'Report a missed morning collection',
      'Change my service location'
    ];
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center sm:justify-start gap-2.5 w-12 h-12 sm:w-auto sm:h-auto sm:px-4 sm:py-3.5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-full shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 ring-4 ring-emerald-100"
            aria-label="Open EcoBot AI Assistant"
          >
            {/* Pulsing online badge */}
            <span className="absolute -top-0.5 -right-0.5 sm:static flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300 sm:bg-emerald-200 border-2 sm:border border-white"></span>
            </span>

            <div className="w-6 h-6 rounded-full sm:bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
            </div>

            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-tight">EcoBot AI</p>
              <p className="text-[10px] text-emerald-100 font-medium">Waste Assistant</p>
            </div>
          </button>
        </div>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed inset-x-2 bottom-2 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-auto sm:w-[420px] h-[min(560px,calc(100dvh-4.5rem))] sm:h-[580px] sm:max-h-[85vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-3 sm:p-4 text-white flex items-center justify-between gap-2 shrink-0 shadow-md">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-emerald-800" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate">EcoBot</h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 uppercase whitespace-nowrap shrink-0">
                    Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/90 font-medium truncate">
                  {currentLocation ? `${currentLocation.areaName}` : '24/7 Waste & Municipal Support'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Language Switcher */}
              <div className="flex items-center bg-emerald-900/60 rounded-xl p-0.5 border border-emerald-600/40 mr-0.5">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    language === 'en'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="English"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('te')}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    language === 'te'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Telugu (తెలుగు)"
                >
                  తె
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('hi')}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    language === 'hi'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Hindi (हिंदी)"
                >
                  हि
                </button>
              </div>

              {/* Clear History */}
              {confirmClear ? (
                <div className="flex items-center gap-1 bg-emerald-900/80 px-1.5 py-0.5 rounded-lg border border-emerald-500/40">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-[10px] font-bold text-rose-200 hover:text-white px-1 whitespace-nowrap"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[10px] text-emerald-200 hover:text-white px-1 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition"
                  title="Clear Chat History"
                  aria-label="Clear chat history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Close */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition"
                title="Minimize EcoBot"
                aria-label="Close EcoBot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Location Badge Indicator */}
          <div className="px-3.5 py-1.5 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-[11px] text-emerald-900">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-semibold truncate">
                {currentLocation ? `${currentLocation.areaName}, ${currentLocation.cityName}` : 'Location unselected'}
              </span>
            </div>
            <button
              type="button"
              onClick={onChangeLocation}
              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0 ml-2"
            >
              Change
            </button>
          </div>

          {/* Message Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/40">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    m.role === 'user'
                      ? 'bg-emerald-700 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>

                {/* Interactive Action Badges */}
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                    {m.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleActionBadgeClick(act)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold transition flex items-center gap-1.5 border border-emerald-300 shadow-2xs"
                      >
                        {act.type === 'TRACK' ? (
                          <MapPin className="w-3 h-3 text-emerald-700" />
                        ) : act.type === 'REQUEST_PICKUP' ? (
                          <Calendar className="w-3 h-3 text-emerald-700" />
                        ) : act.type === 'CHANGE_LOCATION' ? (
                          <RotateCcw className="w-3 h-3 text-emerald-700" />
                        ) : (
                          <ExternalLink className="w-3 h-3 text-emerald-700" />
                        )}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 max-w-[70%]">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span className="italic">EcoBot is analyzing waste schedules...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            {getQuickQuestions().map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q)}
                disabled={isSending}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 text-[11px] font-medium text-slate-600 transition whitespace-nowrap shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                language === 'te'
                  ? 'మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి...'
                  : language === 'hi'
                  ? 'अपना प्रश्न यहाँ लिखें...'
                  : 'Ask EcoBot about pickups, recycling, or schedules...'
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-xs text-slate-800"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              aria-label="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

function getWelcomeMessage(lang: 'en' | 'te' | 'hi', areaName?: string): string {
  const area = areaName || 'your municipal ward';
  if (lang === 'te') {
    return `నమస్కారం! నేను ఎకోట్రాక్ (EcoTrack) AI అసిస్టెంట్‌ని. ${area} లో చెత్త సేకరణ సమయాలు, పికప్ అభ్యర్థనలు, లైవ్ ట్రాకింగ్ మరియు చెత్త విభజన నిబంధనల గురించి మీ ప్రశ్నలకు సహాయం చేయడానికి నేను సిద్ధంగా ఉన్నాను.`;
  }
  if (lang === 'hi') {
    return `नमस्ते! मैं इकोट्रैक (EcoTrack) का आधिकारिक एआई सहायक हूँ। ${area} में कचरा संग्रहण समय, पिकअप ट्रैकिंग, कचरा पृथक्करण नियमों और शिकायतों के लिए मैं आपकी सहायता कर सकता हूँ।`;
  }
  return `Hello! I am EcoBot, your municipal waste management assistant for ${area}. I can help you check pickup schedules, track assigned collection trucks, understand dry vs wet waste segregation, or report missed collections.`;
}
