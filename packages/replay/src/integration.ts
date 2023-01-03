import { getCurrentHub } from '@sentry/core';
import type { BrowserClientReplayOptions } from '@sentry/types';
import { Integration } from '@sentry/types';

import { DEFAULT_ERROR_SAMPLE_RATE, DEFAULT_SESSION_SAMPLE_RATE, MASK_ALL_TEXT_SELECTOR } from './constants';
import { ReplayContainer } from './replay';
import type { RecordingOptions, ReplayConfiguration, ReplayOptions } from './types';
import { isBrowser } from './util/isBrowser';

const MEDIA_SELECTORS = 'img,image,svg,path,rect,area,video,object,picture,embed,map,audio';

let _initialized = false;

export class Replay implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'Replay';

  /**
   * @inheritDoc
   */
  public name: string = Replay.id;

  /**
   * Options to pass to `rrweb.record()`
   */
  readonly recordingOptions: RecordingOptions;

  readonly options: ReplayOptions;

  protected get _isInitialized(): boolean {
    return _initialized;
  }

  protected set _isInitialized(value: boolean) {
    _initialized = value;
  }

  private _replay?: ReplayContainer;

  constructor({
    flushMinDelay = 5000,
    flushMaxDelay = 15000,
    initialFlushDelay = 5000,
    stickySession = true,
    useCompression = true,
    sessionSampleRate,
    errorSampleRate,
    maskAllText,
    maskAllInputs = true,
    maskTextClass = 'sentry-mask',
    maskTextSelector,
    blockAllMedia = true,
    blockClass = 'sentry-block',
    blockSelector = '[data-sentry-block]',
    ignoreClass = 'sentry-ignore',
    _experiments = {},
    recordingOptions = {},
    ...rest
  }: ReplayConfiguration = {}) {
    this.recordingOptions = {
      maskAllInputs,
      blockClass,
      ignoreClass,
      maskTextClass,
      maskTextSelector,
      blockSelector,
      ...recordingOptions,
    };

    this.options = {
      flushMinDelay,
      flushMaxDelay,
      stickySession,
      initialFlushDelay,
      sessionSampleRate: DEFAULT_SESSION_SAMPLE_RATE,
      errorSampleRate: DEFAULT_ERROR_SAMPLE_RATE,
      useCompression,
      _experiments,
    };

    if (Object.keys(rest).length > 0) {
      // eslint-disable-next-line
      console.warn(`[Replay] You are passing unknown option(s) to the Replay integration: ${Object.keys(rest).join(',')}
This is deprecated and will not be supported in future versions.
Instead, put recording-specific configuration into \`recordingOptions\`, e.g. \`recordingOptions: { inlineStylesheet: false }\`.`);

      this.recordingOptions = {
        ...this.recordingOptions,
        ...rest,
      };
    }

    if (typeof sessionSampleRate === 'number') {
      // eslint-disable-next-line
      console.warn(
        `[Replay] You are passing \`sessionSampleRate\` to the Replay integration.
This option is deprecated and will be removed soon.
Instead, configure \`replaysSessionSampleRate\` directly in the SDK init options, e.g.:
Sentry.init({ replaysSessionSampleRate: ${sessionSampleRate} })`,
      );

      this.options.sessionSampleRate = sessionSampleRate;
    }

    if (typeof errorSampleRate === 'number') {
      // eslint-disable-next-line
      console.warn(
        `[Replay] You are passing \`errorSampleRate\` to the Replay integration.
This option is deprecated and will be removed soon.
Instead, configure \`replaysOnErrorSampleRate\` directly in the SDK init options, e.g.:
Sentry.init({ replaysOnErrorSampleRate: ${errorSampleRate} })`,
      );

      this.options.errorSampleRate = errorSampleRate;
    }

    // We want to default `maskAllText` to true, unless `maskTextSelector` has been set
    if (maskAllText || (!maskTextSelector && maskAllText !== false)) {
      // `maskAllText` is a more user friendly option to configure
      // `maskTextSelector`. This means that all nodes will have their text
      // content masked.
      this.recordingOptions.maskTextSelector = MASK_ALL_TEXT_SELECTOR;
    }

    if (blockAllMedia) {
      // `blockAllMedia` is a more user friendly option to configure blocking
      // embedded media elements
      this.recordingOptions.blockSelector = !this.recordingOptions.blockSelector
        ? MEDIA_SELECTORS
        : `${this.recordingOptions.blockSelector},${MEDIA_SELECTORS}`;
    }

    if (isBrowser() && this._isInitialized) {
      throw new Error('Multiple Sentry Session Replay instances are not supported');
    }

    this._isInitialized = true;
  }

  /**
   * We previously used to create a transaction in `setupOnce` and it would
   * potentially create a transaction before some native SDK integrations have run
   * and applied their own global event processor. An example is:
   * https://github.com/getsentry/sentry-javascript/blob/b47ceafbdac7f8b99093ce6023726ad4687edc48/packages/browser/src/integrations/useragent.ts
   *
   * So we call `replay.setup` in next event loop as a workaround to wait for other
   * global event processors to finish. This is no longer needed, but keeping it
   * here to avoid any future issues.
   */
  setupOnce(): void {
    if (!isBrowser()) {
      return;
    }

    this._setup();

    // XXX: See method comments above
    setTimeout(() => this.start());
  }

  /**
   * Initializes the plugin.
   *
   * Creates or loads a session, attaches listeners to varying events (DOM,
   * PerformanceObserver, Recording, Sentry SDK, etc)
   */
  start(): void {
    if (!this._replay) {
      return;
    }

    this._replay.start();
  }

  /**
   * Currently, this needs to be manually called (e.g. for tests). Sentry SDK
   * does not support a teardown
   */
  stop(): void {
    if (!this._replay) {
      return;
    }

    this._replay.stop();
  }

  private _setup(): void {
    // Client is not available in constructor, so we need to wait until setupOnce
    this._loadReplayOptionsFromClient();

    this._replay = new ReplayContainer({
      options: this.options,
      recordingOptions: this.recordingOptions,
    });
  }

  /** Parse Replay-related options from SDK options */
  private _loadReplayOptionsFromClient(): void {
    const client = getCurrentHub().getClient();
    const opt = client && (client.getOptions() as BrowserClientReplayOptions | undefined);

    if (opt && typeof opt.replaysSessionSampleRate === 'number') {
      this.options.sessionSampleRate = opt.replaysSessionSampleRate;
    }

    if (opt && typeof opt.replaysOnErrorSampleRate === 'number') {
      this.options.errorSampleRate = opt.replaysOnErrorSampleRate;
    }
  }
}