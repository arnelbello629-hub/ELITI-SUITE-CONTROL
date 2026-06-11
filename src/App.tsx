import React, { useState, useEffect } from 'react';
import {
  Lightbulb, Power, Fan, Blinds, Settings,
  Thermometer, Sun, Repeat, Camera, Tablet,
} from 'lucide-react';
import { Device } from './types';
import { useHomeAssistant } from './hooks/useHomeAssistant';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { AirconMode, BlindAction } from './services/homeAssistant';
import coreSystemLogo from './assets/core-system.png';

type ActiveView = 'dashboard' | 'settings';

const isLightDevice = (device: Device) =>
  device.type === 'switch' || device.type === 'light';

const LightBulbIcon = ({ active }: { active: boolean }) => (
  <Lightbulb
    className={`w-6 h-6 stroke-[1.5] transition-all ${
      active
        ? 'text-yellow-100 fill-yellow-400 stroke-yellow-200 drop-shadow-[0_0_14px_rgba(250,204,21,1)]'
        : 'text-slate-300 fill-none'
    }`}
  />
);

const FanIcon = ({ active }: { active: boolean }) => (
  <Fan
    className={`w-6 h-6 stroke-[1.5] transition-all ${
      active
        ? 'text-green-100 fill-green-400 stroke-green-300 drop-shadow-[0_0_14px_rgba(74,222,128,1)]'
        : 'text-slate-300 fill-none'
    }`}
  />
);

const AirconIcon = ({ active }: { active: boolean }) => (
  <Thermometer
    className={`w-6 h-6 stroke-[1.5] transition-all ${
      active
        ? 'text-sky-100 fill-sky-400 stroke-sky-200 drop-shadow-[0_0_14px_rgba(56,189,248,1)]'
        : 'text-slate-300 fill-none'
    }`}
  />
);

const getIconClassName = (device: Device, highlighted?: boolean) => {
  const isActive = highlighted ?? device.isOn;

  if (isActive && device.type === 'blind') {
    return 'w-6 h-6 stroke-[1.5] text-sky-200 fill-sky-400/80 drop-shadow-[0_0_16px_rgba(125,211,252,1)]';
  }
  return 'w-6 h-6 stroke-[1.5] text-slate-300 fill-none';
};

const getDeviceIcon = (device: Device, highlighted?: boolean) => {
  const isActive = highlighted ?? device.isOn;
  const className = getIconClassName(device, highlighted);

  switch (device.type) {
    case 'light':
    case 'switch':
      return <LightBulbIcon active={isActive} />;
    case 'fan':
      return <FanIcon active={isActive} />;
    case 'aircon':
      return <AirconIcon active={isActive} />;
    case 'blind':
      return <Blinds className={className} />;
    default:
      return <Power className={className} />;
  }
};

const getDeviceCardClass = (device: Device, isOn: boolean) => {
  if (!isOn) return 'ha-card-off';
  if (isLightDevice(device)) return 'ha-card-on';
  return 'ha-card-off';
};

const getIconCircleClass = (device: Device, isOn: boolean) => {
  if (!isOn) return 'bg-white/[0.05] border-white/[0.10]';
  if (isLightDevice(device)) {
    return 'bg-yellow-400/20 border-yellow-400/35 shadow-[0_0_14px_rgba(250,204,21,0.45)]';
  }
  if (device.type === 'fan') {
    return 'bg-green-400/20 border-green-400/35 shadow-[0_0_14px_rgba(74,222,128,0.45)]';
  }
  if (device.type === 'aircon') {
    return 'bg-sky-400/20 border-sky-400/35 shadow-[0_0_14px_rgba(56,189,248,0.45)]';
  }
  return 'bg-white/[0.05] border-white/[0.10]';
};

const BLIND_ACTIONS: { action: BlindAction; label: string }[] = [
  { action: 'open', label: 'OPEN' },
  { action: 'close', label: 'CLOSE' },
  { action: 'stop', label: 'STOP' },
  { action: 'tilt', label: 'TILT' },
  { action: 'open_tilt', label: 'OPEN TILT' },
];

const FanLevelIndicator = ({
  device,
  onLevel,
}: {
  device: Device;
  onLevel: (level: 1 | 2 | 3) => void;
}) => (
  <div className="flex gap-1.5 mt-2">
    {([1, 2, 3] as const).map((level) => {
      const isActive = device.isOn && device.fanLevel === level;
      return (
        <button
          key={level}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLevel(level);
          }}
          className={`flex-1 h-7 rounded-lg border text-[11px] font-semibold transition-all outline-none focus:ring-1 focus:ring-green-300/40 ${
            isActive
              ? 'border-green-300/80 bg-green-400/45 text-green-100 shadow-[0_0_16px_rgba(74,222,128,0.65)]'
              : 'border-white/[0.10] bg-white/[0.04] text-slate-300 hover:text-green-200 hover:border-green-400/50'
          }`}
        >
          {level}
        </button>
      );
    })}
  </div>
);

const AirconModeIndicator = ({
  device,
  onMode,
}: {
  device: Device;
  onMode: (mode: AirconMode) => void;
}) => {
  const modes: { mode: AirconMode; label: string }[] = [
    { mode: 'auto', label: 'Auto' },
    { mode: 'cool', label: 'Cool' },
  ];

  return (
    <div className="flex gap-1.5 mt-2">
      {modes.map(({ mode, label }) => {
        const isConfigured = Boolean(device.airconScenes?.[mode]);
        const isActive = device.isOn && device.airconMode === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={!isConfigured}
            onClick={(e) => {
              e.stopPropagation();
              if (isConfigured) onMode(mode);
            }}
            className={`flex-1 h-7 rounded-lg border text-[11px] font-semibold transition-all outline-none focus:ring-1 focus:ring-sky-300/40 ${
              !isConfigured
                ? 'border-white/[0.05] bg-transparent text-slate-500 cursor-not-allowed'
                : isActive
                  ? 'border-sky-300/80 bg-sky-400/45 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.65)]'
                  : 'border-white/[0.10] bg-white/[0.04] text-slate-300 hover:text-sky-200 hover:border-sky-400/50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

type DeviceCardProps = {
  device: Device;
  onToggle: () => void;
  onFanLevel?: (level: 1 | 2 | 3) => void;
  onAirconMode?: (mode: AirconMode) => void;
};

type BlindCardProps = {
  device: Device;
  onAction: (action: BlindAction) => void;
};

type StatusVariant = 'light' | 'fan' | 'blue' | 'default';

const getStatusVariant = (device: Device): StatusVariant => {
  if (!device.isOn) return 'default';
  if (isLightDevice(device)) return 'light';
  if (device.type === 'fan') return 'fan';
  if (device.type === 'aircon' || device.type === 'blind') return 'blue';
  return 'default';
};

const STATUS_GLOW: Record<Exclude<StatusVariant, 'default'>, string> = {
  light: 'border-yellow-200/80 bg-yellow-300/45 text-yellow-50 shadow-[0_0_16px_rgba(253,224,71,0.65)]',
  fan: 'border-green-300/80 bg-green-400/45 text-green-50 shadow-[0_0_16px_rgba(74,222,128,0.65)]',
  blue: 'border-sky-300/80 bg-sky-400/45 text-sky-50 shadow-[0_0_16px_rgba(125,211,252,0.65)]',
};

const StatusBadge = ({
  isOn,
  variant,
  glow = false,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  isOn: boolean;
  variant: StatusVariant;
  glow?: boolean;
  onLabel?: string;
  offLabel?: string;
}) => {
  const litVariant = glow ? variant : isOn ? variant : 'default';

  return (
    <div
      className={`px-2.5 h-[28px] rounded-full border flex items-center justify-center text-[11px] font-semibold tracking-wide shrink-0 ${
        litVariant === 'light' || litVariant === 'fan' || litVariant === 'blue'
          ? STATUS_GLOW[litVariant]
          : isOn
            ? 'border-white/20 bg-white/[0.06] text-white'
            : 'border-slate-600 bg-white/[0.04] text-slate-300'
      }`}
    >
      {isOn ? onLabel : offLabel}
    </div>
  );
};

const BLIND_BUTTON_ACTIVE =
  'border-sky-300/80 bg-sky-400/45 text-sky-50 shadow-[0_0_16px_rgba(125,211,252,0.65)]';
const BLIND_BUTTON_IDLE =
  'border-white/[0.10] bg-white/[0.05] text-slate-200 hover:text-white hover:border-white/[0.18] hover:bg-white/[0.09]';

const BlindCard: React.FC<BlindCardProps> = ({ device, onAction }) => {
  const [activeAction, setActiveAction] = useState<BlindAction | null>(null);

  const handleAction = (action: BlindAction) => {
    setActiveAction(action);
    onAction(action);
  };

  return (
    <div className="ha-card ha-card-off col-span-2 min-w-0 p-4 flex flex-col gap-3 text-left relative outline-none">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-full backdrop-blur-sm border transition-all ${
            device.isOn
              ? 'bg-sky-400/20 border-sky-400/35 shadow-[0_0_14px_rgba(56,189,248,0.45)]'
              : 'bg-white/[0.05] border-white/[0.10]'
          }`}
        >
          {getDeviceIcon(device)}
        </div>
        <div className="font-display font-medium text-[15px] tracking-wide leading-tight truncate text-white text-right flex-1 min-w-0">
          {device.name}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 min-w-0 w-full">
        {BLIND_ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            onClick={() => handleAction(action)}
            className={`h-9 rounded-xl border text-[10px] font-semibold uppercase tracking-wide leading-tight px-1 transition-all outline-none focus:ring-1 focus:ring-sky-300/40 ${
              activeAction === action ? BLIND_BUTTON_ACTIVE : BLIND_BUTTON_IDLE
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onToggle, onFanLevel, onAirconMode }) => {
  const isOn = device.isOn;
  const isFan = device.type === 'fan';
  const isAircon = device.type === 'aircon';

  return (
    <div className={`ha-card ${getDeviceCardClass(device, isOn)} min-w-0 p-[18px] flex flex-col justify-between aspect-[0.9] text-left relative overflow-hidden group`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-xl"
      >
        <div className="flex justify-between items-start w-full gap-2">
          <div
            className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-full backdrop-blur-sm border transition-all ${getIconCircleClass(device, isOn)}`}
          >
            {getDeviceIcon(device)}
          </div>
          <StatusBadge isOn={isOn} variant={getStatusVariant(device)} />
        </div>

        <div className="font-display font-medium text-[16px] tracking-wide leading-tight line-clamp-2 text-white mt-auto pt-3">
          {device.name}
        </div>
      </button>

      {isFan && onFanLevel && (
        <FanLevelIndicator device={device} onLevel={onFanLevel} />
      )}

      {isAircon && onAirconMode && (
        <AirconModeIndicator device={device} onMode={onAirconMode} />
      )}
    </div>
  );
};

const connectionLabel: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  offline: 'Offline',
};

export default function App() {
  const {
    zones,
    toggleDevice,
    toggleLightByEntityId,
    blindAction,
    setFanLevel,
    setAirconMode,
    weather,
    connectionStatus,
    turnAllLightsOn,
    turnAllLightsOff,
    turnAllFansOff,
    turnAllAirconOff,
    allBlindsOpen,
    allBlindsClose,
    refreshStates,
    updateDeviceLabel,
    resetDeviceLabel,
  } = useHomeAssistant();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen w-full max-w-[100vw] p-4 md:p-8 flex justify-center items-start lg:items-center relative overflow-x-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={coreSystemLogo}
            alt=""
            aria-hidden="true"
            className="w-[min(90vw,960px)] max-h-[80vh] object-contain opacity-[0.68] brightness-110 contrast-105 translate-x-0 translate-y-[50px] md:translate-x-[100px] lg:translate-x-[196px]"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 800px at 50% 45%, rgba(14,165,233,0.08) 0%, rgba(0,0,0,0) 60%), radial-gradient(900px 700px at 55% 40%, rgba(186,230,253,0.06) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(15,23,42,0.14) 0%, rgba(15,23,42,0.04) 45%, rgba(15,23,42,0.14) 100%)',
          }}
        />
      </div>
      <div className="relative flex w-full max-w-[1700px] min-w-0 flex-col lg:flex-row lg:h-[calc(100vh-64px)] gap-6 lg:gap-8">
        
        <Sidebar
          timeString={timeString}
          dateString={dateString}
          connectionStatus={connectionStatus}
          connectionLabel={connectionLabel}
          zones={zones}
          weather={weather}
          onRefresh={refreshStates}
          onLightsOn={turnAllLightsOn}
          onLightsOff={turnAllLightsOff}
          onFansOff={turnAllFansOff}
          onAirconOff={turnAllAirconOff}
          onBlindsOpen={allBlindsOpen}
          onBlindsClose={allBlindsClose}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 w-full lg:overflow-y-auto hide-scrollbar z-10 mx-0 lg:mx-2 pl-0 lg:pl-6 pb-28 lg:pb-32">
          {activeView === 'settings' ? (
            <SettingsPanel
              zones={zones}
              onUpdateLabel={updateDeviceLabel}
              onResetLabel={resetDeviceLabel}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-12 gap-x-6 min-w-0 w-full">
              {zones.map((zone) => (
                <div key={zone.id} className="break-inside-avoid min-w-0 w-full">
                  <h2 className="text-[20px] font-display font-medium text-white mb-6 tracking-wide text-center w-full">
                    {zone.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 min-w-0 w-full">
                    {zone.devices.map((device) =>
                      device.type === 'blind' ? (
                        <BlindCard
                          key={device.id}
                          device={device}
                          onAction={(action) => blindAction(device.entityId, action)}
                        />
                      ) : (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          onToggle={() =>
                            isLightDevice(device)
                              ? toggleLightByEntityId(device.entityId)
                              : toggleDevice(zone.id, device.id)
                          }
                          onFanLevel={
                            device.type === 'fan'
                              ? (level) => setFanLevel(device.entityId, level)
                              : undefined
                          }
                          onAirconMode={
                            device.type === 'aircon'
                              ? (mode) => setAirconMode(device.id, mode)
                              : undefined
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        
        {/* Bottom Navigation Bar — desktop position unchanged at lg+ */}
        <div className="fixed lg:absolute bottom-4 lg:bottom-10 left-4 right-4 lg:left-[410px] lg:right-10 z-50 flex justify-center pointer-events-none max-w-[calc(100vw-2rem)] lg:max-w-none mx-auto lg:mx-0">
          <div className="flex gap-2 pointer-events-auto glass-pill p-2 rounded-full max-w-full overflow-x-auto hide-scrollbar dashboard-nav-scroll">
            {([
              { id: 'dashboard' as const, icon: Sun, label: 'Scenes' },
              { id: 'dashboard' as const, icon: Repeat, label: 'Automations' },
              { id: 'dashboard' as const, icon: Camera, label: 'Cameras' },
              { id: 'dashboard' as const, icon: Tablet, label: 'Displays' },
              { id: 'settings' as const, icon: Settings, label: 'Settings' },
            ]).map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`flex items-center gap-[10px] px-6 py-3 rounded-full transition-all whitespace-nowrap outline-none focus:ring-2 focus:ring-white/20 ${
                    isActive
                      ? 'bg-white/[0.10] text-white'
                      : 'bg-transparent hover:bg-white/[0.05] text-slate-200 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-[18px] h-[18px] ${isActive ? 'opacity-100' : 'opacity-85'}`} />
                  <span className="text-[14px] font-medium tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
