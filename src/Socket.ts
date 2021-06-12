import WebSocket from 'isomorphic-ws';
import {EventEmitter} from 'events';
import Debug from 'debug';

export type ConnectArgs = {
  address?: string;
  secure?: boolean
  password?: string
};

export default class Socket extends EventEmitter {
  private connected = false;
  private socket?: WebSocket = null;
  private debug = Debug('obs-websocket-js:Socket');

  constructor() {
    super();

    const originalEmit = this.emit;
    // TODO: test this
    this.emit = function (event: string | symbol, ...args) {
      this.debug('[emit] %s err: %o data: %o', ...args);
      return originalEmit.apply(this, args);
    };
  }

  async connect(args: ConnectArgs = {}): Promise<void> {
    args = {
      address: 'localhost:4444',
      password: '',
      secure: false,
      ...args,
    };

    if (this.socket) {
      try {
        // Blindly try to close the socket.
        // Don't care if its already closed.
        // We just don't want any sockets to leak.
        this.socket.close();
      } catch (error) {
        // These errors are probably safe to ignore, but debug log them just in case.
        this.debug('Failed to close previous WebSocket:', error.message);
      }
    }
  }
}
