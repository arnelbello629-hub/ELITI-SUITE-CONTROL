export type DeviceType = 'light' | 'switch' | 'fan' | 'blind' | 'aircon';

export type BlindSceneAction = 'open' | 'close' | 'stop' | 'tilt' | 'open_tilt';

export interface BlindScenes {
  open: string;
  close: string;
  stop: string;
  tilt: string;
  open_tilt: string;
}

export interface ToggleScenes {
  on: string;
  off: string;
}

export type AirconMode = 'auto' | 'cool';

export interface AirconScenes {
  on: string;
  off: string;
  auto?: string;
  cool?: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  isOn: boolean;
  value?: number | string;
  entityId: string;
  position?: number;
  tilt?: number;
  blindScenes?: BlindScenes;
  airconScenes?: AirconScenes;
  airconMode?: AirconMode;
  lightScenes?: ToggleScenes;
  /** Optional entity used to read live on/off state (e.g. switch behind a light plug). */
  stateEntityId?: string;
  fanLevel?: 1 | 2 | 3;
}

export interface Zone {
  id: string;
  name: string;
  devices: Device[];
}

