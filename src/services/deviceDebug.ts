export function logDeviceToggle(payload: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.info('[device-toggle]', {
      time: new Date().toISOString(),
      ...payload,
    });
  }
}
