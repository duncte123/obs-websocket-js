import Socket from './Socket.js';
import Status from './Status.js';
import {Callback, RequestMethodReturnMap, RequestMethodsArgsMap} from './typings/obsWebsocket';

export default class OBSWebSocket extends Socket {
  private static requestCounter = 0;

  private static generateMessageId(): string {
    return String(OBSWebSocket.requestCounter++);
  }

  // TODO: generate types
  async send<K extends keyof RequestMethodsArgsMap>(
    requestType: K,
    args: RequestMethodsArgsMap[K] extends object ? [RequestMethodsArgsMap[K]] : [undefined?]
  ): Promise<RequestMethodReturnMap[K]> {
    args = args || {};

    return new Promise((resolve, reject) => {
      const messageId = OBSWebSocket.generateMessageId();
      let rejectReason;

      if (!requestType) {
        rejectReason = Status.REQUEST_TYPE_NOT_SPECIFIED;
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
        // @ts-ignore
        args['request-type'] = requestType;
        // @ts-ignore
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
    args: RequestMethodsArgsMap[K] | Callback<K>,
    callback: Callback<K>
  ) { // eslint-disable-line default-param-last
    // Allow the `args` argument to be omitted.
    if (callback === undefined && typeof args === 'function') {
      callback = args;
      // @ts-ignore
      args = {};
    }

    // Perform the actual request, using `send`.
    // @ts-ignore
    this.send(requestType, args).then((...response) => {
      callback(undefined, ...response);
    }).catch((error: Error) => {
      callback(error);
    });
  }
}
