import { Device, Zone } from '../types';

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

const HA_URL = import.meta.env.VITE_HA_URL?.replace(/\/$/, '') ?? '';
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN ?? '';
const API_BASE = import.meta.env.DEV ? '/ha-api' : HA_URL;

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${HA_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export function getWebSocketUrl(): string {
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ha-api/api/websocket`;
  }
  const wsBase = HA_URL.replace(/^http/, 'ws');
  return `${wsBase}/api/websocket`;
}

export async function fetchAllStates(): Promise<HassEntityState[]> {
  const response = await fetch(`${API_BASE}/api/states`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to fetch states (${response.status})`);
  }
  return response.json();
}

export async function callService(
  domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entity_id: entityId, ...data }),
  });
  if (!response.ok) {
    throw new Error(`Service call failed (${response.status})`);
  }
}

export const WEATHER_ENTITY_ID = 'weather.forecast_home';

export type WeatherInfo = {
  temperature: number;
  humidity: number;
  condition: string;
  conditionKey: string;
};

const WEATHER_LABELS: Record<string, string> = {
  sunny: 'Sunny',
  partlycloudy: 'Partly cloudy',
  cloudy: 'Cloudy',
  rainy: 'Rainy',
  pouring: 'Heavy rain',
  snowy: 'Snowy',
  fog: 'Foggy',
  windy: 'Windy',
  hail: 'Hail',
  lightning: 'Thunderstorm',
  'clear-night': 'Clear night',
};

export function mapWeatherState(haState: HassEntityState | undefined): WeatherInfo | null {
  if (!haState || haState.state === 'unavailable' || haState.state === 'unknown') return null;

  const temperature = haState.attributes.temperature as number | undefined;
  if (temperature === undefined) return null;

  return {
    temperature: Math.round(temperature),
    humidity: Math.round((haState.attributes.humidity as number) ?? 0),
    conditionKey: haState.state,
    condition: WEATHER_LABELS[haState.state] ?? haState.state.replace(/-/g, ' '),
  };
}

export function mapHaStateToDevice(device: Device, haState: HassEntityState): Device {
  const { state, attributes } = haState;

  if (state === 'unavailable' || state === 'unknown') {
    return { ...device, isOn: false, value: undefined, position: undefined, tilt: undefined };
  }

  const domain = device.entityId.split('.')[0];

  if (device.type === 'blind' || domain === 'cover') {
    const position = attributes.current_position as number | undefined;
    const tilt = attributes.current_tilt_position as number | undefined;
    const isOpen = state === 'open' || state === 'opening' || (position ?? 0) > 0;
    const statusLabel =
      state === 'open' || state === 'closed' || state === 'opening' || state === 'closing'
        ? state.charAt(0).toUpperCase() + state.slice(1)
        : position !== undefined
          ? position > 50
            ? 'Open'
            : 'Closed'
          : isOpen
            ? 'Open'
            : 'Closed';
    return { ...device, isOn: isOpen, value: statusLabel, position, tilt };
  }

  if (device.type === 'aircon' && domain === 'climate') {
    const temp = (attributes.temperature ?? attributes.current_temperature) as number | undefined;
    const isOn = state !== 'off';
    return {
      ...device,
      isOn,
      value: temp !== undefined ? `${Math.round(temp)}°C` : device.value,
    };
  }

  if (device.type === 'aircon' && device.airconScenes) {
    return device;
  }

  const isOn = state === 'on';
  let value: string | undefined;

  if (device.type === 'light' && typeof attributes.brightness === 'number') {
    value = `${Math.round((attributes.brightness / 255) * 100)}%`;
  }

  if (device.type === 'fan') {
    const percentage = attributes.percentage as number | undefined;
    const fanLevel =
      isOn && typeof percentage === 'number' ? percentageToFanLevel(percentage) : undefined;
    return { ...device, isOn, fanLevel, value: undefined };
  }

  return { ...device, isOn, value };
}

export function percentageToFanLevel(percentage: number): 1 | 2 | 3 {
  if (percentage <= 33) return 1;
  if (percentage <= 66) return 2;
  return 3;
}

export function fanLevelToPercentage(level: 1 | 2 | 3): number {
  if (level === 1) return 33;
  if (level === 2) return 66;
  return 100;
}

export type AirconMode = import('../types').AirconMode;

export function getAirconModeService(
  device: Device,
  mode: AirconMode,
): { domain: string; service: string; entityId: string } | null {
  const sceneId = device.airconScenes?.[mode];
  if (!sceneId) return null;
  return { domain: 'scene', service: 'turn_on', entityId: sceneId };
}

export type BlindAction = 'open' | 'close' | 'stop' | 'tilt' | 'open_tilt';

export function getBlindService(
  device: Device,
  action: BlindAction,
): { domain: string; service: string; entityId: string; data?: Record<string, unknown> } {
  const sceneId = device.blindScenes?.[action];
  if (sceneId) {
    return { domain: 'scene', service: 'turn_on', entityId: sceneId };
  }

  const coverServices: Record<BlindAction, string> = {
    open: 'open_cover',
    close: 'close_cover',
    stop: 'stop_cover',
    tilt: 'close_cover_tilt',
    open_tilt: 'open_cover_tilt',
  };

  return { domain: 'cover', service: coverServices[action], entityId: device.entityId };
}

export function getToggleAction(
  device: Device,
): { domain: string; service: string; entityId: string; data?: Record<string, unknown> } {
  if (device.airconScenes) {
    return {
      domain: 'scene',
      service: 'turn_on',
      entityId: device.isOn ? device.airconScenes.off : device.airconScenes.on,
    };
  }

  const domain = device.entityId.split('.')[0];

  // Direct switch/light control (same as iot) — preferred over scene-based toggles
  if (
    device.type === 'switch' ||
    device.type === 'light' ||
    domain === 'switch' ||
    domain === 'light'
  ) {
    return {
      domain,
      service: device.isOn ? 'turn_off' : 'turn_on',
      entityId: device.entityId,
    };
  }

  if (device.lightScenes) {
    return {
      domain: 'scene',
      service: 'turn_on',
      entityId: device.isOn ? device.lightScenes.off : device.lightScenes.on,
    };
  }

  switch (domain) {
    case 'switch':
      return { domain: 'switch', service: device.isOn ? 'turn_off' : 'turn_on', entityId: device.entityId };
    case 'light':
      return { domain: 'light', service: device.isOn ? 'turn_off' : 'turn_on', entityId: device.entityId };
    case 'fan':
      return { domain: 'fan', service: 'toggle', entityId: device.entityId };
    case 'cover':
      return { domain: 'cover', service: device.isOn ? 'close_cover' : 'open_cover', entityId: device.entityId };
    case 'climate':
      return { domain: 'climate', service: device.isOn ? 'turn_off' : 'turn_on', entityId: device.entityId };
    default:
      return { domain, service: 'toggle', entityId: device.entityId };
  }
}

function isSceneEntityRegistered(
  sceneId: string | undefined,
  stateMap: Map<string, HassEntityState>,
): boolean {
  if (!sceneId) return false;
  const state = stateMap.get(sceneId);
  return Boolean(state && state.state !== 'unavailable');
}

export function resolveAirconFromScenes(
  device: Device,
  stateMap: Map<string, HassEntityState>,
): Device {
  if (!device.airconScenes) return device;

  const { on, off, auto, cool } = device.airconScenes;
  const onState = stateMap.get(on);
  const offState = stateMap.get(off);

  let isOn = device.isOn;
  if (onState && offState) {
    isOn =
      new Date(onState.last_changed).getTime() > new Date(offState.last_changed).getTime();
  }

  let airconMode = device.airconMode;
  if (isOn) {
    const autoState = auto ? stateMap.get(auto) : undefined;
    const coolState = cool ? stateMap.get(cool) : undefined;
    if (autoState && coolState) {
      airconMode =
        new Date(autoState.last_changed).getTime() > new Date(coolState.last_changed).getTime()
          ? 'auto'
          : 'cool';
    } else if (autoState) {
      airconMode = 'auto';
    } else if (coolState) {
      airconMode = 'cool';
    }
  } else {
    airconMode = undefined;
  }

  const airconScenes: NonNullable<Device['airconScenes']> = { on, off };
  if (isSceneEntityRegistered(auto, stateMap) && auto) airconScenes.auto = auto;
  if (isSceneEntityRegistered(cool, stateMap) && cool) airconScenes.cool = cool;

  return { ...device, isOn, airconMode, airconScenes };
}

export function resolveLightFromScenes(
  device: Device,
  stateMap: Map<string, HassEntityState>,
): Device {
  if (!device.lightScenes) return device;

  const { on, off } = device.lightScenes;
  const onState = stateMap.get(on);
  const offState = stateMap.get(off);

  if (!onState || !offState) return device;

  const isOn =
    new Date(onState.last_changed).getTime() > new Date(offState.last_changed).getTime();

  return { ...device, isOn };
}

export function isLightSceneEntity(entityId: string, device: Device): boolean {
  if (!device.lightScenes) return false;
  return entityId === device.lightScenes.on || entityId === device.lightScenes.off;
}

export function applyLightSceneEvent(device: Device, entityId: string): Device {
  if (!device.lightScenes) return device;

  if (entityId === device.lightScenes.on) {
    return { ...device, isOn: true };
  }
  if (entityId === device.lightScenes.off) {
    return { ...device, isOn: false };
  }

  return device;
}

export function isAirconSceneEntity(entityId: string, device: Device): boolean {
  if (device.type !== 'aircon' || !device.airconScenes) return false;
  return Object.values(device.airconScenes).includes(entityId);
}

export function applyAirconSceneEvent(device: Device, entityId: string): Device {
  if (!device.airconScenes) return device;

  if (entityId === device.airconScenes.on) {
    return { ...device, isOn: true };
  }
  if (entityId === device.airconScenes.off) {
    return { ...device, isOn: false, airconMode: undefined };
  }
  if (entityId === device.airconScenes.auto) {
    return { ...device, isOn: true, airconMode: 'auto' };
  }
  if (entityId === device.airconScenes.cool) {
    return { ...device, isOn: true, airconMode: 'cool' };
  }

  return device;
}

export function mergeZonesWithStates(zones: Zone[], states: HassEntityState[]): Zone[] {
  const stateMap = new Map(states.map((s) => [s.entity_id, s]));

  return zones.map((zone) => ({
    ...zone,
    devices: zone.devices.map((device) => {
      if (device.type === 'aircon' && device.airconScenes) {
        return resolveAirconFromScenes(device, stateMap);
      }

      if (device.lightScenes) {
        const stateKey = device.stateEntityId ?? device.entityId;
        const haState = stateMap.get(stateKey);
        const stateUnavailable =
          !haState || haState.state === 'unavailable' || haState.state === 'unknown';

        if (stateUnavailable) {
          return resolveLightFromScenes(device, stateMap);
        }

        return mapHaStateToDevice(device, haState);
      }

      const stateKey = device.stateEntityId ?? device.entityId;
      const haState = stateMap.get(stateKey);
      if (!haState) return device;
      return mapHaStateToDevice(device, haState);
    }),
  }));
}

export function isHaConfigured(): boolean {
  return Boolean(HA_TOKEN && (import.meta.env.DEV || HA_URL));
}
