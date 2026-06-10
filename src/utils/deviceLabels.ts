import { ZONE_CONFIG } from '../config/zones';
import { Zone } from '../types';

const STORAGE_KEY = 'esc-device-labels';

export type DeviceLabelMap = Record<string, string>;

const DEFAULT_NAMES: DeviceLabelMap = Object.fromEntries(
  ZONE_CONFIG.flatMap((zone) => zone.devices.map((device) => [device.id, device.name])),
);

export function loadDeviceLabels(): DeviceLabelMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DeviceLabelMap;
  } catch {
    return {};
  }
}

export function saveDeviceLabels(labels: DeviceLabelMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
}

export function getDefaultDeviceName(deviceId: string): string {
  return DEFAULT_NAMES[deviceId] ?? deviceId;
}

export function resolveDeviceName(deviceId: string, labels: DeviceLabelMap): string {
  const custom = labels[deviceId]?.trim();
  return custom || getDefaultDeviceName(deviceId);
}

export function applyDeviceLabels(zones: Zone[], labels: DeviceLabelMap): Zone[] {
  return zones.map((zone) => ({
    ...zone,
    devices: zone.devices.map((device) => ({
      ...device,
      name: resolveDeviceName(device.id, labels),
    })),
  }));
}

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  switch: 'Switch',
  light: 'Light',
  fan: 'Fan',
  blind: 'Blinds',
  aircon: 'Aircon',
};
