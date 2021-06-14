import { RequestMethodReturnMap, RequestMethodsArgsMap } from './typings/obsWebsocket';

export interface IOBSWebSocket {
  send<K extends keyof RequestMethodsArgsMap>(
    requestType: K,
    args?: RequestMethodsArgsMap[K] extends object ? RequestMethodsArgsMap[K] : undefined
  ): Promise<RequestMethodReturnMap[K]>;
}
