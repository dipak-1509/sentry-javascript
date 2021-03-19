import { SentryEvent, StackFrame, IntegrationV7, ClientLike } from '@sentry/types';

import { patchWebAssembly } from './patchWebAssembly';
import { getImage, getImages } from './registry';

/** plz don't */
function patchFrames(frames: Array<StackFrame>): boolean {
  let haveWasm = false;
  frames.forEach(frame => {
    if (!frame.filename) {
      return;
    }
    const match = frame.filename.match(/^(.*?):wasm-function\[\d+\]:(0x[a-fA-F0-9]+)$/);
    if (match !== null) {
      const index = getImage(match[1]);
      if (index >= 0) {
        frame.instruction_addr = match[2];
        frame.addr_mode = `rel:${index}`;
        frame.filename = match[1];
        frame.platform = 'native';
        haveWasm = true;
      }
    }
  });
  return haveWasm;
}

// TODO: Make it integration?

/**
 * Process WASM stack traces to support server-side symbolication.
 *
 * This also hooks the WebAssembly loading browser API so that module
 * registraitons are intercepted.
 */
export class Wasm implements IntegrationV7 {
  public name = this.constructor.name;

  /**
   * @inheritDoc
   */
  public install(client: ClientLike): void {
    patchWebAssembly();

    client.addEventProcessor((event: SentryEvent) => {
      let haveWasm = false;

      if (event.exception && event.exception.values) {
        event.exception.values.forEach(exception => {
          if (exception?.stacktrace?.frames) {
            haveWasm = haveWasm || patchFrames(exception.stacktrace.frames);
          }
        });
      }
      if (event.stacktrace?.frames) {
        haveWasm = haveWasm || patchFrames(event.stacktrace.frames);
      }

      if (haveWasm) {
        event.debug_meta = event.debug_meta || {};
        event.debug_meta.images = getImages();
      }

      return event;
    });
  }
}
