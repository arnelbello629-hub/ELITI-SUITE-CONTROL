const DEBOUNCE_MS = 150;

interface CommandRecord {
  targetKey: string;
  sentAt: number;
}

const recentCommands = new Map<string, CommandRecord>();

export function shouldSkipCommand(entityId: string, targetKey: string): boolean {
  const prev = recentCommands.get(entityId);
  const now = Date.now();
  if (prev && prev.targetKey === targetKey && now - prev.sentAt < DEBOUNCE_MS) {
    return true;
  }
  return false;
}

export function recordCommand(entityId: string, targetKey: string): void {
  recentCommands.set(entityId, { targetKey, sentAt: Date.now() });
}
