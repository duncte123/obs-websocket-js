import { Debugger } from 'debug';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function (debug: Debugger, prefix: string, error: any): void {
  if (error && error.stack) {
    debug(`${prefix}\n %O`, error.stack);
  } else if (typeof error === 'object') {
    debug(`${prefix} %o`, error);
  } else {
    debug(`${prefix} %s`, error);
  }
}
