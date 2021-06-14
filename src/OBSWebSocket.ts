import Socket from './Socket.js';
import Status, { StatusType } from './Status.js';
import { Callback, RequestMethodReturnMap, RequestMethodsArgsMap } from './typings/obsWebsocket';
import { IOBSWebSocket } from './IOBSWebSocket';

export default class OBSWebSocket extends Socket implements IOBSWebSocket {
  private static requestCounter = 0;

  private static generateMessageId(): string {
    return String(OBSWebSocket.requestCounter++);
  }

  send<K extends keyof RequestMethodsArgsMap>(
    requestType: K,
    args?: RequestMethodsArgsMap[K] extends object ? RequestMethodsArgsMap[K] : undefined
  ): Promise<RequestMethodReturnMap[K]> {
    // @ts-ignore this assignment works in js
    // eslint-disable-next-line no-param-reassign
    args = args || {};

    return new Promise((resolve, reject) => {
      const messageId = OBSWebSocket.generateMessageId();
      let rejectReason: StatusType|null = null;

      if (!requestType) {
        rejectReason = Status.REQUEST_TYPE_NOT_SPECIFIED;
      }

      if (args && (typeof args !== 'object' || Array.isArray(args))) {
        rejectReason = Status.ARGS_NOT_OBJECT;
      }

      if (!this.connected) {
        rejectReason = Status.NOT_CONNECTED;
      }

      // Assign a temporary event listener for this particular messageId to uniquely identify the response.
      this.once(`obs:internal:message:id-${messageId}`, (err, data) => {
        if (err) {
          this.debug('[send:reject] %o', err);
          reject(err);
        } else {
          this.debug('[send:resolve] %o', data);
          resolve(data);
        }
      });

      // If we don't have a reason to fail fast, send the request to the socket.
      if (!rejectReason) {
        // @ts-ignore not documented but required
        args['request-type'] = requestType;
        // @ts-ignore not documented but required
        args['message-id'] = messageId;

        // Submit the request to the websocket.
        this.debug('[send] %s %s %o', messageId, requestType, args);
        try {
          this.socket.send(JSON.stringify(args));
        } catch (_) {
          // TODO: Consider inspecting the exception thrown to gleam some relevant info and pass that on.
          rejectReason = Status.SOCKET_EXCEPTION;
        }
      }

      // If the socket call was unsuccessful or bypassed, simulate its resolution.
      if (rejectReason) {
        this.emit(`obs:internal:message:id-${messageId}`, rejectReason);
      }
    });
  }

  /**
   *
   * @param requestType
   * @param args
   * @param callback
   * @deprecated for removal, hell to maintian
   */
  // this is hell to maintain in typescript and will be removed
  sendCallback<K extends keyof RequestMethodsArgsMap>(
    requestType: K,
    args?: RequestMethodsArgsMap[K] extends object ? RequestMethodsArgsMap[K] : Callback<K>,
    callback?: Callback<K> | undefined
  ): void { // eslint-disable-line default-param-last
    // Allow the `args` argument to be omitted.
    if (typeof callback === 'undefined' && typeof args === 'function') {
      // eslint-disable-next-line no-param-reassign
      callback = args;
      // @ts-ignore this is valid
      // eslint-disable-next-line no-param-reassign
      args = {};
    }

    // Perform the actual request, using `send`.
    // @ts-ignore args is stupid
    this.send(requestType, args).then((...response) => {
      // @ts-ignore is not undefined
      callback(null, ...response);
    })
      .catch((error: Error) => {
        // @ts-ignore is not undefined
        callback(error);
      });
  }
}
