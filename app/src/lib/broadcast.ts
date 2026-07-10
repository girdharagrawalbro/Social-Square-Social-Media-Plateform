// Simple event emitter implementation for React Native
type Handler = (data: any) => void;

class EventEmitter {
  private events: { [key: string]: Handler[] } = {};

  on(event: string, handler: Handler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(h => h !== handler);
  }

  emit(event: string, data: any) {
    if (!this.events[event]) return;
    this.events[event].forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error('Error in event listener:', e);
      }
    });
  }
}

const emitter = new EventEmitter();

export const appChannel = {
  postMessage: (payload: { type: string; [key: string]: any }) => {
    emitter.emit(payload.type, payload);
  },
  on: (type: string, handler: Handler) => {
    return emitter.on(type, handler);
  },
  off: (type: string, handler: Handler) => {
    emitter.off(type, handler);
  },
  // Keep compatibility with old structure
  onmessage: null as any,
};
