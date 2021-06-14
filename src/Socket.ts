import WebSocket from 'isomorphic-ws';
import {EventEmitter} from 'events';
import Debug from 'debug';
import Status from './Status.js';
import hash from './utils/authenticationHashing.js';
import logAmbiguousError from './utils/logAmbiguousError.js';
import camelCaseKeys from './utils/camelCaseKeys.js';
import {EventHandlersDataMap} from './typings/obsWebsocket';

export type ConnectArgs = {
  address?: string;
  secure?: boolean
  password?: string
};

export default class Socket extends EventEmitter {
  protected connected = false;
  protected socket: WebSocket;
  protected debug = Debug('obs-websocket-js:Socket');

  constructor() {
    super();

    const originalEmit = this.emit;
    // TODO: test this
    this.emit = function (event: string | symbol, ...args) {
      this.debug('[emit] %s err: %o data: %o', ...args);
      return originalEmit.apply(this, args);
    };
  }

  on<K extends keyof EventHandlersDataMap>(event: K, listener: (data: EventHandlersDataMap[K]) => void): this {
    return super.on(event, listener);
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

    try {
      await this.connect0(args.address!!, args.secure!!);
      await this.authenticate(args.password);
    } catch (e) {
      this.socket.close();
      this.connected = false;
      logAmbiguousError(this.debug, 'Connection failed:', e);
      // retrhow to let the user handle it
      throw e;
    }
  }

  private connect0(address: string, secure: boolean): Promise<void> {
    // we need to wrap this in a promise so we can resolve only when connected
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      this.debug('Attempting to connect to: %s (secure: %s)', address, secure);
      this.socket = new WebSocket((secure ? 'wss://' : 'ws://') + address);

      // We only handle the initial connection error.
      // Beyond that, the consumer is responsible for adding their own generic `error` event listener.
      // FIXME: Unsure how best to expose additional information about the WebSocket error.
      this.socket.onerror = (err: WebSocket.ErrorEvent) => {
        if (settled) {
          logAmbiguousError(this.debug, 'Unknown Socket Error', err);
          this.emit('error', err);
          return;
        }

        settled = true;
        logAmbiguousError(this.debug, 'Websocket Connection failed:', err);
        reject( Status.CONNECTION_ERROR);
      };

      this.socket.onopen = () => {
        if (settled) {
          return;
        }

        this.connected = true;
        settled = true;

        this.debug('Connection opened: %s', address);
        this.emit('ConnectionOpened');
        resolve();
      };

      // Looks like this should be bound. We don't technically cancel the connection when the authentication fails.
      this.socket.onclose = () => {
        this.connected = false;
        this.debug('Connection closed: %s', address);
        this.emit('ConnectionClosed');
      };

      // This handler must be present before we can call _authenticate.
      this.socket.onmessage = (msg: WebSocket.MessageEvent) => {
        this.debug('[OnMessage]: %o', msg);
        const message = camelCaseKeys(JSON.parse(msg.data));
        let err;
        let data;

        if (message.status === 'error') {
          err = message;
        } else {
          data = message;
        }

        // Emit the message with ID if available, otherwise try to find a non-messageId driven event.
        if (message.messageId) {
          this.emit(`obs:internal:message:id-${message.messageId}`, err, data);
        } else if (message.updateType) {
          this.emit(message.updateType, data);
        } else {
          logAmbiguousError(this.debug, 'Unrecognized Socket Message:', message);
          this.emit('message', message);
        }
      }
    });
  }

  private async authenticate(password = '') {
    if (!this.connected) {
      throw Status.NOT_CONNECTED;
    }

    // TODO: where the fuck is this method defined?
    const auth = await this.send('GetAuthRequired');

    if (!auth.authRequired) {
      this.debug('Authentication not Required');
      this.emit('AuthenticationSuccess');
      return Status.AUTH_NOT_REQUIRED;
    }

    try {
      await this.send('Authenticate', {
        auth: hash(auth.salt, auth.challenge, password)
      });
    } catch (e) {
      this.debug('Authentication Failure %o', e);
      this.emit('AuthenticationFailure');
      throw e;
    }

    this.debug('Authentication Success');
    this.emit('AuthenticationSuccess');
  }

  async disconnect() {
    this.debug('Disconnect requested.');

    if (this.socket) {
      this.socket.close();
    }
  }
}
