import { useCallback, useEffect, useRef, useState } from 'react';
import { ZONE_CONFIG } from '../config/zones';
import {
  BlindAction,
  callService,
  fetchAllStates,
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
import { Zone } from '../types';
import {
  applyDeviceLabels,
  DeviceLabelMap,
  loadDeviceLabels,
  resolveDeviceName,
  saveDeviceLabels,
} from '../utils/deviceLabels';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export function useHomeAssistant() {
  const [labels, setLabels] = useState<DeviceLabelMap>(() => loadDeviceLabels());
  const [zones, setZones] = useState<Zone[]>(() => applyDeviceLabels(ZONE_CONFIG, loadDeviceLabels()));
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    isHaConfigured() ? 'connecting' : 'offline',
  );
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const msgIdRef = useRef(1);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          return stateKey === haState.entity_id ? mapHaStateToDevice(device, haState) : device;
        }),
      })),
    );
  }, []);

  const loadStates = useCallback(async () => {
    const states = await fetchAllStates();
    const weatherState = states.find((state) => state.entity_id === WEATHER_ENTITY_ID);
    setWeather(mapWeatherState(weatherState));
    setZones(applyDeviceLabels(mergeZonesWithStates(ZONE_CONFIG, states), labels));
  }, [labels]);

  const connectWebSocket = useCallback(() => {
    if (!isHaConfigured()) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      // auth_required is sent by HA on connect
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: import.meta.env.VITE_HA_TOKEN }));
        return;
      }

      if (message.type === 'auth_ok') {
        const subscribeId = msgIdRef.current++;
        ws.send(
          JSON.stringify({
            id: subscribeId,
            type: 'subscribe_events',
            event_type: 'state_changed',
          }),
        );
        setConnectionStatus('connected');
        return;
      }

      if (message.type === 'auth_invalid') {
        setConnectionStatus('disconnected');
        ws.close();
        return;
      }

      if (message.type === 'event' && message.event?.event_type === 'state_changed') {
        const newState = message.event.data?.new_state as HassEntityState | null;
        if (newState?.entity_id) {
          applyEntityState(newState);
        }
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;
      reconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [applyEntityState]);

  useEffect(() => {
    if (!isHaConfigured()) return;

    let cancelled = false;

    (async () => {
      try {
        await loadStates();
        if (!cancelled) connectWebSocket();
      } catch {
        if (!cancelled) setConnectionStatus('disconnected');
      }
    })();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket, loadStates]);

  const toggleDevice = useCallback(async (zoneId: string, deviceId: string) => {
    let previousDevice: Zone['devices'][number] | undefined;

    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        return {
          ...zone,
          devices: zone.devices.map((device) => {
            if (device.id !== deviceId) return device;
            previousDevice = device;

            let newValue = device.value;
            if (device.type === 'blind') {
              newValue = device.isOn ? 'Closed' : 'Open';
            }

            return { ...device, isOn: !device.isOn, value: newValue };
          }),
        };
      }),
    );

    if (!previousDevice || !isHaConfigured()) return;

    try {
      const { domain, service, entityId, data } = getToggleAction(previousDevice);
      await callService(domain, service, entityId, data);
      if (
        previousDevice.type === 'aircon' ||
        previousDevice.lightScenes ||
        previousDevice.type === 'light' ||
        previousDevice.type === 'switch'
      ) {
        await loadStates();
      }
    } catch {
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
    }
  }, [loadStates]);

  const blindAction = useCallback(async (entityId: string, action: BlindAction) => {
    if (!isHaConfigured()) return;

    const device = zones
      .flatMap((zone) => zone.devices)
      .find((d) => d.entityId === entityId && d.type === 'blind');

    if (!device) return;

    try {
      const { domain, service, entityId: targetId, data } = getBlindService(device, action);
      await callService(domain, service, targetId, data);
      await loadStates();
    } catch {
      await loadStates();
    }
  }, [zones, loadStates]);

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
      await callService('fan', 'turn_on', entityId, { percentage });
    } catch {
      await loadStates();
    }
  }, [loadStates]);

  const setAirconMode = useCallback(async (deviceId: string, mode: AirconMode) => {
    if (!isHaConfigured()) return;

    const device = zones
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
      await callService(action.domain, action.service, action.entityId);
      await loadStates();
    } catch {
      await loadStates();
    }
  }, [zones, loadStates]);

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

  const turnAllLightsOff = useCallback(async () => {
    if (!isHaConfigured()) return;

    const devicesOn = zones.flatMap((zone) =>
      zone.devices
        .filter((device) => (device.type === 'light' || device.type === 'switch') && device.isOn)
        .map((device) => ({ zoneId: zone.id, device })),
    );

    for (const { device } of devicesOn) {
      try {
        const { domain, service, entityId, data } = getToggleAction(device);
        await callService(domain, service, entityId, data);
      } catch {
        // continue turning off remaining lights
      }
    }

    await loadStates();
  }, [zones, loadStates]);

  const allBlindsAction = useCallback(async (action: BlindAction) => {
    if (!isHaConfigured()) return;

    const blinds = zones.flatMap((zone) =>
      zone.devices.filter((device) => device.type === 'blind'),
    );

    for (const device of blinds) {
      try {
        const { domain, service, entityId, data } = getBlindService(device, action);
        await callService(domain, service, entityId, data);
      } catch {
        // continue with remaining blinds
      }
    }

    await loadStates();
  }, [zones, loadStates]);

  const turnAllFansOff = useCallback(async () => {
    if (!isHaConfigured()) return;

    const fansOn = zones
      .flatMap((zone) => zone.devices)
      .filter((device) => device.type === 'fan' && device.isOn);

    for (const device of fansOn) {
      try {
        await callService('fan', 'turn_off', device.entityId);
      } catch {
        // continue
      }
    }

    await loadStates();
  }, [zones, loadStates]);

  const turnAllAirconOff = useCallback(async () => {
    if (!isHaConfigured()) return;

    const airconsOn = zones
      .flatMap((zone) => zone.devices)
      .filter((device) => device.type === 'aircon' && device.isOn);

    for (const device of airconsOn) {
      try {
        if (device.airconScenes?.off) {
          await callService('scene', 'turn_on', device.airconScenes.off);
        }
      } catch {
        // continue
      }
    }

    await loadStates();
  }, [zones, loadStates]);

  return {
    zones,
    weather,
    toggleDevice,
    blindAction,
    setFanLevel,
    setAirconMode,
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
