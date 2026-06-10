import { useCallback, useEffect, useRef, useState } from 'react';
import { ZONE_CONFIG } from '../config/zones';
import {
  BlindAction,
  callService,
  AirconMode,
  fanLevelToPercentage,
  getAirconModeService,
  getBlindService,
  getToggleAction,
  getWebSocketUrl,
  isHaConfigured,
  applyAirconSceneEvent,
  applyLightSceneEvent,
  isAirconSceneEntity,
  isLightSceneEntity,
  mapHaStateToDevice,
  mapWeatherState,
  mergeZonesWithStates,
  HassEntityState,
  WeatherInfo,
  WEATHER_ENTITY_ID,
} from '../services/homeAssistant';
import { recordCommand, shouldSkipCommand } from '../services/commandGate';
import { logDeviceToggle } from '../services/deviceDebug';
import { HaWebSocket } from '../services/haWebSocket';
import { Device, Zone } from '../types';
import {
  applyDeviceLabels,
  DeviceLabelMap,
  loadDeviceLabels,
  resolveDeviceName,
  saveDeviceLabels,
} from '../utils/deviceLabels';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

const PENDING_TOGGLE_MS = 4000;

type PendingToggle = {
  until: number;
  expectedOn: boolean;
};

function isLightDevice(device: Device): boolean {
  return device.type === 'light' || device.type === 'switch';
}

function getLightDomain(entityId: string): string {
  return entityId.split('.')[0] ?? 'switch';
}

function applyPendingToggles(zones: Zone[], pending: Map<string, PendingToggle>): Zone[] {
  return zones.map((zone) => ({
    ...zone,
    devices: zone.devices.map((device) => {
      const toggle = pending.get(device.entityId);
      if (toggle && Date.now() < toggle.until) {
        return { ...device, isOn: toggle.expectedOn };
      }
      return device;
    }),
  }));
}

export function useHomeAssistant() {
  const [labels, setLabels] = useState<DeviceLabelMap>(() => loadDeviceLabels());
  const [zones, setZones] = useState<Zone[]>(() => applyDeviceLabels(ZONE_CONFIG, loadDeviceLabels()));
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    isHaConfigured() ? 'connecting' : 'offline',
  );
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const haRef = useRef<HaWebSocket | null>(null);
  const labelsRef = useRef(labels);
  const zonesRef = useRef(zones);
  const pendingTogglesRef = useRef(new Map<string, PendingToggle>());

  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const findDeviceByEntityId = useCallback((entityId: string): Device | undefined => {
    return zonesRef.current.flatMap((zone) => zone.devices).find((device) => device.entityId === entityId);
  }, []);

  const markPendingToggle = useCallback((entityId: string, expectedOn: boolean) => {
    pendingTogglesRef.current.set(entityId, {
      until: Date.now() + PENDING_TOGGLE_MS,
      expectedOn,
    });
  }, []);

  const applyStates = useCallback((states: HassEntityState[]) => {
    const weatherState = states.find((state) => state.entity_id === WEATHER_ENTITY_ID);
    setWeather(mapWeatherState(weatherState));
    const merged = applyDeviceLabels(mergeZonesWithStates(ZONE_CONFIG, states), labelsRef.current);
    setZones(applyPendingToggles(merged, pendingTogglesRef.current));
  }, []);

  const applyEntityState = useCallback((haState: HassEntityState) => {
    if (haState.entity_id === WEATHER_ENTITY_ID) {
      setWeather(mapWeatherState(haState));
      return;
    }

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) => {
          if (isAirconSceneEntity(haState.entity_id, device)) {
            return applyAirconSceneEvent(device, haState.entity_id);
          }

          if (isLightSceneEntity(haState.entity_id, device)) {
            return applyLightSceneEvent(device, haState.entity_id);
          }

          const stateKey = device.stateEntityId ?? device.entityId;
          if (stateKey !== haState.entity_id) return device;

          const pending = pendingTogglesRef.current.get(stateKey);
          const haOn = haState.state === 'on';

          if (pending && Date.now() < pending.until) {
            if (haOn === pending.expectedOn) {
              pendingTogglesRef.current.delete(stateKey);
              return mapHaStateToDevice(device, haState);
            }
            return { ...device, isOn: pending.expectedOn };
          }

          return mapHaStateToDevice(device, haState);
        }),
      })),
    );
  }, []);

  const loadStates = useCallback(async () => {
    const ha = haRef.current;
    if (ha?.isConnected) {
      const states = await ha.getStates();
      applyStates(states);
      return;
    }

    const states = await fetchAllStatesFallback();
    applyStates(states);
  }, [applyStates]);

  const invokeService = useCallback(async (
    domain: string,
    service: string,
    entityId: string,
    data?: Record<string, unknown>,
  ) => {
    const ha = haRef.current;
    if (ha?.isConnected) {
      await ha.callService(domain, service, entityId, data);
      return;
    }

    await callService(domain, service, entityId, data);
  }, []);

  const sendLightCommand = useCallback((
    device: Device,
    service: 'turn_on' | 'turn_off',
    currentOn: boolean,
    newOn: boolean,
  ) => {
    const domain = getLightDomain(device.entityId);

    logDeviceToggle({
      deviceId: device.id,
      entityId: device.entityId,
      name: device.name,
      currentState: currentOn ? 'on' : 'off',
      newState: newOn ? 'on' : 'off',
      command: `${domain}.${service}`,
    });

    const sentViaWs = haRef.current?.callServiceFireAndForget(domain, service, device.entityId) ?? false;

    if (sentViaWs) {
      logDeviceToggle({
        entityId: device.entityId,
        response: 'WebSocket command sent',
      });
      return;
    }

    void callService(domain, service, device.entityId)
      .then(() => {
        logDeviceToggle({
          entityId: device.entityId,
          response: 'REST ok',
        });
      })
      .catch((error: unknown) => {
        logDeviceToggle({
          entityId: device.entityId,
          response: `REST failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
  }, []);

  useEffect(() => {
    if (!isHaConfigured()) return;

    const ha = new HaWebSocket(getWebSocketUrl(), import.meta.env.VITE_HA_TOKEN, {
      onConnected: () => setConnectionStatus('connected'),
      onDisconnected: () => setConnectionStatus('disconnected'),
      onStates: (states) => {
        applyStates(states);
        setConnectionStatus('connected');
      },
      onStateChanged: applyEntityState,
    });

    haRef.current = ha;
    setConnectionStatus('connecting');
    ha.connect();

    return () => {
      ha.disconnect();
      haRef.current = null;
    };
  }, [applyEntityState, applyStates]);

  const revertDevice = useCallback((
    zoneId: string,
    deviceId: string,
    previousDevice: Zone['devices'][number],
  ) => {
    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        return {
          ...zone,
          devices: zone.devices.map((device) =>
            device.id === deviceId ? previousDevice : device,
          ),
        };
      }),
    );
  }, []);

  const toggleLightByEntityId = useCallback((entityId: string) => {
    const device = findDeviceByEntityId(entityId);
    if (!device || !isLightDevice(device)) {
      logDeviceToggle({ entityId, error: 'Light device not found' });
      return;
    }

    if (!isHaConfigured()) {
      logDeviceToggle({ entityId, error: 'Home Assistant not configured' });
      return;
    }

    const currentOn = device.isOn;
    const newOn = !currentOn;
    const domain = getLightDomain(entityId);
    const service = newOn ? 'turn_on' : 'turn_off';
    const commandKey = `${domain}.${service}:{}`;

    if (shouldSkipCommand(entityId, commandKey)) {
      logDeviceToggle({ entityId, skipped: true, reason: 'duplicate command' });
      return;
    }

    recordCommand(entityId, commandKey);
    markPendingToggle(entityId, newOn);

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((d) =>
          d.entityId === entityId ? { ...d, isOn: newOn } : d,
        ),
      })),
    );

    sendLightCommand(device, service, currentOn, newOn);
  }, [findDeviceByEntityId, markPendingToggle, sendLightCommand]);

  const toggleDevice = useCallback((zoneId: string, deviceId: string) => {
    const currentDevice = zonesRef.current
      .find((zone) => zone.id === zoneId)
      ?.devices.find((device) => device.id === deviceId);

    if (!currentDevice) {
      logDeviceToggle({ zoneId, deviceId, error: 'Device not found' });
      return;
    }

    if (isLightDevice(currentDevice)) {
      toggleLightByEntityId(currentDevice.entityId);
      return;
    }

    if (!isHaConfigured()) return;

    const previousDevice = currentDevice;

    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        return {
          ...zone,
          devices: zone.devices.map((device) => {
            if (device.id !== deviceId) return device;

            let newValue = device.value;
            if (device.type === 'blind') {
              newValue = device.isOn ? 'Closed' : 'Open';
            }

            return { ...device, isOn: !device.isOn, value: newValue };
          }),
        };
      }),
    );

    const { domain, service, entityId, data } = getToggleAction(previousDevice);

    logDeviceToggle({
      deviceId,
      entityId,
      name: previousDevice.name,
      currentState: previousDevice.isOn ? 'on' : 'off',
      newState: !previousDevice.isOn ? 'on' : 'off',
      command: `${domain}.${service}`,
    });

    void invokeService(domain, service, entityId, data)
      .then(() => {
        logDeviceToggle({ entityId, response: 'ok' });
      })
      .catch((error: unknown) => {
        logDeviceToggle({
          entityId,
          response: `failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        revertDevice(zoneId, deviceId, previousDevice);
      });
  }, [invokeService, revertDevice, toggleLightByEntityId]);

  const blindAction = useCallback(async (entityId: string, action: BlindAction) => {
    if (!isHaConfigured()) return;

    const device = zonesRef.current
      .flatMap((zone) => zone.devices)
      .find((d) => d.entityId === entityId && d.type === 'blind');

    if (!device) return;

    try {
      const { domain, service, entityId: targetId, data } = getBlindService(device, action);
      await invokeService(domain, service, targetId, data);
    } catch {
      await loadStates();
    }
  }, [invokeService, loadStates]);

  const setFanLevel = useCallback(async (entityId: string, level: 1 | 2 | 3) => {
    if (!isHaConfigured()) return;

    const percentage = fanLevelToPercentage(level);

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          device.entityId === entityId && device.type === 'fan'
            ? { ...device, isOn: true, fanLevel: level }
            : device,
        ),
      })),
    );

    try {
      await invokeService('fan', 'turn_on', entityId, { percentage });
    } catch {
      await loadStates();
    }
  }, [invokeService, loadStates]);

  const setAirconMode = useCallback(async (deviceId: string, mode: AirconMode) => {
    if (!isHaConfigured()) return;

    const device = zonesRef.current
      .flatMap((zone) => zone.devices)
      .find((d) => d.id === deviceId && d.type === 'aircon');

    const action = device ? getAirconModeService(device, mode) : null;
    if (!action) return;

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((d) =>
          d.id === deviceId ? { ...d, isOn: true, airconMode: mode } : d,
        ),
      })),
    );

    try {
      await invokeService(action.domain, action.service, action.entityId);
    } catch {
      await loadStates();
    }
  }, [invokeService, loadStates]);

  const updateDeviceLabel = useCallback((deviceId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    setLabels((prev) => {
      const next = { ...prev, [deviceId]: trimmed };
      saveDeviceLabels(next);
      return next;
    });

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          device.id === deviceId ? { ...device, name: trimmed } : device,
        ),
      })),
    );
  }, []);

  const resetDeviceLabel = useCallback((deviceId: string) => {
    setLabels((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      saveDeviceLabels(next);
      return next;
    });

    const defaultName = resolveDeviceName(deviceId, {});
    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          device.id === deviceId ? { ...device, name: defaultName } : device,
        ),
      })),
    );
  }, []);

  const turnAllLights = useCallback((action: 'on' | 'off') => {
    if (!isHaConfigured()) return;

    const newOn = action === 'on';

    const targetDevices = zonesRef.current
      .flatMap((zone) => zone.devices)
      .filter((device) => isLightDevice(device) && device.isOn !== newOn);

    logDeviceToggle({
      scope: 'all-lights',
      action,
      count: targetDevices.length,
      entityIds: targetDevices.map((d) => d.entityId),
    });

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          isLightDevice(device) ? { ...device, isOn: newOn } : device,
        ),
      })),
    );

    for (const device of targetDevices) {
      markPendingToggle(device.entityId, newOn);
      sendLightCommand(device, newOn ? 'turn_on' : 'turn_off', !newOn, newOn);
    }
  }, [markPendingToggle, sendLightCommand]);

  const turnAllLightsOn = useCallback(() => turnAllLights('on'), [turnAllLights]);
  const turnAllLightsOff = useCallback(() => turnAllLights('off'), [turnAllLights]);

  const allBlindsAction = useCallback(async (action: BlindAction) => {
    if (!isHaConfigured()) return;

    const blinds = zonesRef.current
      .flatMap((zone) => zone.devices)
      .filter((device) => device.type === 'blind');

    for (const device of blinds) {
      try {
        const { domain, service, entityId, data } = getBlindService(device, action);
        await invokeService(domain, service, entityId, data);
      } catch {
        // continue with remaining blinds
      }
    }
  }, [invokeService]);

  const turnAllFansOff = useCallback(async () => {
    if (!isHaConfigured()) return;

    const fansOn = zonesRef.current
      .flatMap((zone) => zone.devices)
      .filter((device) => device.type === 'fan' && device.isOn);

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          device.type === 'fan' ? { ...device, isOn: false, fanLevel: undefined } : device,
        ),
      })),
    );

    for (const device of fansOn) {
      try {
        await invokeService('fan', 'turn_off', device.entityId);
      } catch {
        // continue
      }
    }
  }, [invokeService]);

  const turnAllAirconOff = useCallback(async () => {
    if (!isHaConfigured()) return;

    const airconsOn = zonesRef.current
      .flatMap((zone) => zone.devices)
      .filter((device) => device.type === 'aircon' && device.isOn);

    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        devices: zone.devices.map((device) =>
          device.type === 'aircon'
            ? { ...device, isOn: false, airconMode: undefined }
            : device,
        ),
      })),
    );

    for (const device of airconsOn) {
      try {
        if (device.airconScenes?.off) {
          await invokeService('scene', 'turn_on', device.airconScenes.off);
        }
      } catch {
        // continue
      }
    }
  }, [invokeService]);

  return {
    zones,
    weather,
    toggleDevice,
    toggleLightByEntityId,
    blindAction,
    setFanLevel,
    setAirconMode,
    turnAllLightsOn,
    turnAllLightsOff,
    turnAllFansOff,
    turnAllAirconOff,
    allBlindsOpen: () => allBlindsAction('open'),
    allBlindsClose: () => allBlindsAction('close'),
    refreshStates: loadStates,
    connectionStatus,
    updateDeviceLabel,
    resetDeviceLabel,
  };
}

async function fetchAllStatesFallback(): Promise<HassEntityState[]> {
  const { fetchAllStates } = await import('../services/homeAssistant');
  return fetchAllStates();
}
