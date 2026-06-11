import React, { useEffect, useState } from 'react';
import { Blinds, Fan, Lightbulb, Thermometer } from 'lucide-react';
import { Zone } from '../types';
import { DEVICE_TYPE_LABELS, getDefaultDeviceName } from '../utils/deviceLabels';

type SettingsPanelProps = {
  zones: Zone[];
  onUpdateLabel: (deviceId: string, label: string) => void;
  onResetLabel: (deviceId: string) => void;
};

const TypeIcon = ({ type }: { type: string }) => {
  const className = 'w-4 h-4 text-slate-300';
  switch (type) {
    case 'fan':
      return <Fan className={className} />;
    case 'blind':
      return <Blinds className={className} />;
    case 'aircon':
      return <Thermometer className={className} />;
    default:
      return <Lightbulb className={className} />;
  }
};

const LabelRow = ({
  deviceId,
  type,
  entityId,
  name,
  onSave,
  onReset,
}: {
  deviceId: string;
  type: string;
  entityId: string;
  name: string;
  onSave: (label: string) => void;
  onReset: () => void;
}) => {
  const [value, setValue] = useState(name);
  const defaultName = getDefaultDeviceName(deviceId);
  const isCustom = name !== defaultName;

  useEffect(() => {
    setValue(name);
  }, [name]);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(defaultName);
      onReset();
      return;
    }
    if (trimmed !== name) onSave(trimmed);
  };

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-white/[0.05] border border-white/[0.10]">
          <TypeIcon type={type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-widest text-slate-300">
            {DEVICE_TYPE_LABELS[type] ?? type}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{entityId}</div>
        </div>
        {isCustom && (
          <button
            type="button"
            onClick={() => {
              setValue(defaultName);
              onReset();
            }}
            className="text-[11px] text-slate-300 hover:text-white transition-colors shrink-0 px-2 py-1 rounded-lg border border-white/[0.08] hover:border-white/[0.14]"
          >
            Reset
          </button>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.10] text-[14px] text-white placeholder:text-slate-400 outline-none focus:border-white/[0.22] focus:ring-1 focus:ring-white/10 transition-all"
        placeholder={defaultName}
      />
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  zones,
  onUpdateLabel,
  onResetLabel,
}) => (
  <div className="max-w-3xl w-full min-w-0">
    <div className="mb-8">
      <h1 className="text-[28px] font-display font-medium text-white tracking-tight">Settings</h1>
      <p className="text-[14px] text-slate-300 mt-2">
        Edit component labels below. Changes save automatically and appear on the dashboard.
      </p>
    </div>

    <div className="space-y-10">
      {zones.map((zone) => (
        <section key={zone.id}>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.18em] text-slate-300 mb-4 px-1">
            {zone.name}
          </h2>
          <div className="space-y-3">
            {zone.devices.map((device) => (
              <div key={device.id}>
                <LabelRow
                  deviceId={device.id}
                  type={device.type}
                  entityId={device.entityId}
                  name={device.name}
                  onSave={(label) => onUpdateLabel(device.id, label)}
                  onReset={() => onResetLabel(device.id)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  </div>
);
