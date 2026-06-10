import React, { useMemo } from 'react';
import {
  Blinds,
  Cloud,
  CloudRain,
  CloudSun,
  Fan,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sun,
  Thermometer,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react';
import { ConnectionStatus } from '../hooks/useHomeAssistant';
import { WeatherInfo } from '../services/homeAssistant';
import { Zone } from '../types';

type SidebarProps = {
  timeString: string;
  dateString: string;
  connectionStatus: ConnectionStatus;
  connectionLabel: Record<string, string>;
  zones: Zone[];
  weather: WeatherInfo | null;
  onRefresh: () => void;
  onLightsOff: () => void;
  onFansOff: () => void;
  onAirconOff: () => void;
  onBlindsOpen: () => void;
  onBlindsClose: () => void;
};

const WeatherIcon = ({ conditionKey }: { conditionKey: string }) => {
  const className = 'w-7 h-7 text-amber-100';
  switch (conditionKey) {
    case 'sunny':
    case 'clear-night':
      return <Sun className={className} />;
    case 'rainy':
    case 'pouring':
    case 'hail':
    case 'lightning':
      return <CloudRain className={className} />;
    case 'windy':
      return <Wind className={className} />;
    case 'partlycloudy':
    case 'cloudy':
      return <CloudSun className={className} />;
    default:
      return <Cloud className={className} />;
  }
};

const CONNECTION_STYLES: Record<ConnectionStatus, { pill: string; icon: string }> = {
  connected: {
    pill: 'border-emerald-400/35 bg-emerald-400/10 shadow-[0_0_14px_rgba(52,211,153,0.12)]',
    icon: 'text-emerald-300',
  },
  connecting: {
    pill: 'border-amber-400/35 bg-amber-400/10',
    icon: 'text-amber-300',
  },
  disconnected: {
    pill: 'border-red-400/30 bg-red-400/8',
    icon: 'text-red-300',
  },
  offline: {
    pill: 'border-slate-500/30 bg-white/[0.04]',
    icon: 'text-slate-300',
  },
};

const ConnectionIcon = ({ status }: { status: ConnectionStatus }) => {
  const className = `w-3.5 h-3.5 ${CONNECTION_STYLES[status].icon}`;
  if (status === 'connecting') return <Loader2 className={`${className} animate-spin`} />;
  if (status === 'connected') return <Wifi className={className} />;
  return <WifiOff className={className} />;
};

const StatCard = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className={`rounded-2xl border p-3.5 ${accent}`}>
    <div className="flex items-center gap-1.5 mb-2">{icon}</div>
    <div className="text-[22px] font-display font-light text-white leading-none">{value}</div>
    <div className="text-[10px] font-medium uppercase tracking-widest text-slate-300 mt-1.5">{label}</div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  timeString,
  dateString,
  connectionStatus,
  connectionLabel,
  zones,
  weather,
  onRefresh,
  onLightsOff,
  onFansOff,
  onAirconOff,
  onBlindsOpen,
  onBlindsClose,
}) => {
  const stats = useMemo(() => {
    const devices = zones.flatMap((zone) => zone.devices);
    return {
      lightsOn: devices.filter((d) => (d.type === 'light' || d.type === 'switch') && d.isOn).length,
      fansOn: devices.filter((d) => d.type === 'fan' && d.isOn).length,
      blindsOpen: devices.filter((d) => d.type === 'blind' && d.isOn).length,
      airconOn: devices.filter((d) => d.type === 'aircon' && d.isOn).length,
    };
  }, [zones]);

  return (
    <aside className="w-[360px] flex-shrink-0 flex flex-col gap-5 z-10 sidebar-panel p-8 overflow-y-auto hide-scrollbar">
      <div className="mt-4">
        <div className="text-[64px] font-display font-light tracking-tighter text-gradient-premium leading-none">
          {timeString}
        </div>
        <div className="text-[14px] font-medium text-slate-300 mt-3 uppercase tracking-widest">
          {dateString}
        </div>
        <div className="flex items-center gap-2.5 mt-4">
          <div
            className={`flex flex-1 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 min-w-0 ${CONNECTION_STYLES[connectionStatus].pill}`}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-white/[0.06] border border-white/[0.08] shrink-0">
              <ConnectionIcon status={connectionStatus} />
            </div>
            <span className="text-[13px] font-medium text-white truncate">
              {connectionLabel[connectionStatus]}
            </span>
            {connectionStatus === 'connected' && (
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh states"
            className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-slate-300 hover:text-white hover:border-white/20 hover:bg-white/[0.07] transition-all outline-none focus:ring-1 focus:ring-white/20 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-slate-300 font-medium uppercase tracking-[0.2em] text-[11px] mb-3">
          Overview
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            icon={<Lightbulb className="w-3.5 h-3.5 text-yellow-300" />}
            label="Lights On"
            value={stats.lightsOn}
            accent="border-yellow-300/15 bg-yellow-400/5"
          />
          <StatCard
            icon={<Fan className="w-3.5 h-3.5 text-green-400" />}
            label="Fans On"
            value={stats.fansOn}
            accent="border-green-400/15 bg-green-400/5"
          />
          <StatCard
            icon={<Blinds className="w-3.5 h-3.5 text-sky-300" />}
            label="Blinds Open"
            value={stats.blindsOpen}
            accent="border-sky-400/15 bg-sky-400/5"
          />
          <StatCard
            icon={<Thermometer className="w-3.5 h-3.5 text-sky-200" />}
            label="Aircon On"
            value={stats.airconOn}
            accent="border-sky-300/15 bg-sky-300/5"
          />
        </div>
      </div>

      <div className="mt-auto pt-2">
        <div className="rounded-[1.75rem] border border-amber-100/20 bg-gradient-to-br from-amber-50/14 via-sky-100/10 to-white/8 p-5 shadow-[0_8px_32px_rgba(251,191,36,0.08),inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100/12 border border-amber-100/20 shadow-[0_0_20px_rgba(251,191,36,0.12)]">
              <WeatherIcon conditionKey={weather?.conditionKey ?? 'cloudy'} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[34px] font-display font-light tracking-tight text-amber-50 leading-none">
                {weather ? `${weather.temperature}°` : '—'}
              </div>
              <div className="text-[13px] text-sky-50 font-medium mt-1.5 truncate">
                {weather?.condition ?? 'Weather unavailable'}
              </div>
            </div>
            {weather && (
              <div className="text-right shrink-0">
                <div className="text-[18px] font-display text-amber-50">{weather.humidity}%</div>
                <div className="text-[9px] uppercase tracking-widest text-amber-100/80 mt-0.5">Humid</div>
              </div>
            )}
          </div>

          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-100/90 mb-3">
            Quick Control
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={onLightsOff}
              disabled={stats.lightsOn === 0}
              className="flex items-center gap-3 w-full rounded-2xl border border-yellow-200/25 bg-yellow-100/10 px-4 py-2.5 text-left transition-all hover:bg-yellow-100/16 hover:border-yellow-200/40 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:ring-1 focus:ring-yellow-200/30"
            >
              <Lightbulb className="w-4 h-4 text-yellow-200 shrink-0" />
              <span className="text-[13px] font-medium text-yellow-50">All Lights Off</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onFansOff}
                disabled={stats.fansOn === 0}
                className="flex items-center justify-center gap-2 rounded-2xl border border-green-300/25 bg-green-100/10 px-3 py-2.5 transition-all hover:bg-green-100/16 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:ring-1 focus:ring-green-300/30"
              >
                <Fan className="w-4 h-4 text-green-300" />
                <span className="text-[12px] font-semibold text-green-50">Fans Off</span>
              </button>
              <button
                type="button"
                onClick={onAirconOff}
                disabled={stats.airconOn === 0}
                className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200/25 bg-sky-100/10 px-3 py-2.5 transition-all hover:bg-sky-100/16 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus:ring-1 focus:ring-sky-200/30"
              >
                <Thermometer className="w-4 h-4 text-sky-200" />
                <span className="text-[12px] font-semibold text-sky-50">AC Off</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onBlindsOpen}
                className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200/25 bg-sky-100/10 px-3 py-2.5 transition-all hover:bg-sky-100/16 outline-none focus:ring-1 focus:ring-sky-200/30"
              >
                <Blinds className="w-4 h-4 text-sky-200" />
                <span className="text-[12px] font-semibold text-sky-50">Open All</span>
              </button>
              <button
                type="button"
                onClick={onBlindsClose}
                className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200/25 bg-sky-100/10 px-3 py-2.5 transition-all hover:bg-sky-100/16 outline-none focus:ring-1 focus:ring-sky-200/30"
              >
                <Blinds className="w-4 h-4 text-sky-200" />
                <span className="text-[12px] font-semibold text-sky-50">Close All</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
