import { HassEntityState } from './homeAssistant';

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export type HaWsCallbacks = {
  onConnected: () => void;
  onDisconnected: () => void;
  onStates: (states: HassEntityState[]) => void;
  onStateChanged: (state: HassEntityState) => void;
};

export class HaWebSocket {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pending = new Map<number, Pending>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private authenticated = false;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly callbacks: HaWsCallbacks,
  ) {}

  get isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.authenticated = false;
    const socket = new WebSocket(this.url);
    this.ws = socket;

    socket.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data) as Record<string, unknown>);
    };

    socket.onclose = () => {
      this.authenticated = false;
      this.ws = null;
      this.rejectAllPending(new Error('WebSocket disconnected'));
      this.callbacks.onDisconnected();
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.authenticated = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new Error('WebSocket closed'));
    this.ws?.close();
    this.ws = null;
  }

  async getStates(): Promise<HassEntityState[]> {
    return (await this.send({ type: 'get_states' })) as HassEntityState[];
  }

  callService(
    domain: string,
    service: string,
    entityId: string,
    serviceData: Record<string, unknown> = {},
  ): Promise<void> {
    return this.send({
      type: 'call_service',
      domain,
      service,
      service_data: serviceData,
      target: { entity_id: entityId },
    }).then(() => undefined);
  }

  /** Fire-and-forget — same pattern as iot client (no wait for HA result ack). */
  callServiceFireAndForget(
    domain: string,
    service: string,
    entityId: string,
    serviceData: Record<string, unknown> = {},
  ): boolean {
    if (!this.authenticated || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const id = this.msgId++;
    this.ws.send(
      JSON.stringify({
        id,
        type: 'call_service',
        domain,
        service,
        service_data: serviceData,
        target: { entity_id: entityId },
      }),
    );
    return true;
  }

  private async bootstrap(): Promise<void> {
    const states = await this.getStates();
    this.callbacks.onStates(states);
    await this.send({ type: 'subscribe_events', event_type: 'state_changed' });
  }

  private send(payload: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, ...payload }));

      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error('Home Assistant request timeout'));
      }, 15000);
    });
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private handleMessage(message: Record<string, unknown>): void {
    if (message.type === 'auth_required') {
      this.ws?.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      return;
    }

    if (message.type === 'auth_ok') {
      this.authenticated = true;
      void this.bootstrap()
        .then(() => this.callbacks.onConnected())
        .catch(() => {
          this.callbacks.onDisconnected();
        });
      return;
    }

    if (message.type === 'auth_invalid') {
      this.shouldReconnect = false;
      this.ws?.close();
      return;
    }

    if (message.type === 'event') {
      const event = message.event as {
        event_type?: string;
        data?: { new_state?: HassEntityState | null };
      } | undefined;

      if (event?.event_type === 'state_changed' && event.data?.new_state?.entity_id) {
        this.callbacks.onStateChanged(event.data.new_state);
      }
      return;
    }

    if (message.type === 'result' && typeof message.id === 'number') {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      this.pending.delete(message.id);
      if (message.success === false) {
        const errorPayload = message.error as { message?: string } | undefined;
        pending.reject(new Error(String(errorPayload?.message ?? 'Home Assistant request failed')));
        return;
      }

      pending.resolve(message.result);
    }
  }
}
