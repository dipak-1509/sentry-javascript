import type { Breadcrumb } from '@sentry/types';

import type {
  HistoryData,
  LargestContentfulPaintData,
  MemoryData,
  NavigationData,
  NetworkRequestData,
  PaintData,
  ResourceData,
} from './performance';
import type { EventType } from './rrweb';

type AnyRecord = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface BaseBreadcrumbFrame {
  timestamp: number;
  /**
   * For compatibility reasons
   */
  type: string;
  category: string;
  data?: AnyRecord;
  message?: string;
}

interface BaseDomFrameData {
  nodeId?: number;
  node?: {
    id: number;
    tagName: string;
    textContent: string;
    attributes: AnyRecord;
  };
}

/* Breadcrumbs from Core SDK */
interface ConsoleFrameData {
  logger: string;
  arguments?: unknown[];
}
interface ConsoleFrame extends BaseBreadcrumbFrame {
  category: 'console';
  level: Breadcrumb['level'];
  message: string;
  data: ConsoleFrameData;
}

type ClickFrameData = BaseDomFrameData;
interface ClickFrame extends BaseBreadcrumbFrame {
  category: 'ui.click';
  message: string;
  data: ClickFrameData;
}

interface InputFrame extends BaseBreadcrumbFrame {
  category: 'ui.input';
  message: string;
}

/* Breadcrumbs from Replay */
interface MutationFrameData {
  count: number;
  limit: boolean;
}
interface MutationFrame extends BaseBreadcrumbFrame {
  category: 'replay.mutations';
  data: MutationFrameData;
}

interface KeyboardEventFrameData extends BaseDomFrameData {
  metaKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  key: string;
}
interface KeyboardEventFrame extends BaseBreadcrumbFrame {
  category: 'ui.keyDown';
  data: KeyboardEventFrameData;
}

interface BlurFrame extends BaseBreadcrumbFrame {
  category: 'ui.blur';
}

interface FocusFrame extends BaseBreadcrumbFrame {
  category: 'ui.focus';
}

interface SlowClickFrameData extends ClickFrameData {
  url: string;
  route?: string;
  timeAfterClickMs: number;
  endReason: string;
  clickCount?: number;
}
export interface SlowClickFrame extends BaseBreadcrumbFrame {
  category: 'ui.slowClickDetected';
  data: SlowClickFrameData;
}

interface MultiClickFrameData extends ClickFrameData {
  url: string;
  route?: string;
  clickCount: number;
  metric: true;
}

export interface MultiClickFrame extends BaseBreadcrumbFrame {
  category: 'ui.multiClick';
  data: MultiClickFrameData;
}

interface OptionFrame {
  blockAllMedia: boolean;
  errorSampleRate: number;
  maskAllInputs: boolean;
  maskAllText: boolean;
  networkCaptureBodies: boolean;
  networkDetailHasUrls: boolean;
  networkRequestHasHeaders: boolean;
  networkResponseHasHeaders: boolean;
  sessionSampleRate: number;
  useCompression: boolean;
  useCompressionOption: boolean;
}

export type BreadcrumbFrame =
  | ConsoleFrame
  | ClickFrame
  | InputFrame
  | KeyboardEventFrame
  | BlurFrame
  | FocusFrame
  | SlowClickFrame
  | MultiClickFrame
  | MutationFrame
  | BaseBreadcrumbFrame;

interface BaseSpanFrame {
  op: string;
  description: string;
  startTimestamp: number;
  endTimestamp: number;
  data?: undefined | AnyRecord;
}

interface HistoryFrame extends BaseSpanFrame {
  data: HistoryData;
  op: 'navigation.push';
}

interface LargestContentfulPaintFrame extends BaseSpanFrame {
  data: LargestContentfulPaintData;
  op: 'largest-contentful-paint';
}

interface MemoryFrame extends BaseSpanFrame {
  data: MemoryData;
  op: 'memory';
}

interface NavigationFrame extends BaseSpanFrame {
  data: NavigationData;
  op: 'navigation.navigate' | 'navigation.reload' | 'navigation.back_forward';
}

interface PaintFrame extends BaseSpanFrame {
  data: PaintData;
  op: 'paint';
}

interface RequestFrame extends BaseSpanFrame {
  data: NetworkRequestData;
  op: 'resource.fetch' | 'resource.xhr';
}

interface ResourceFrame extends BaseSpanFrame {
  data: ResourceData;
  op: 'resource.css' | 'resource.iframe' | 'resource.img' | 'resource.link' | 'resource.other' | 'resource.script';
}

export type SpanFrame =
  | BaseSpanFrame
  | HistoryFrame
  | RequestFrame
  | LargestContentfulPaintFrame
  | MemoryFrame
  | NavigationFrame
  | PaintFrame
  | ResourceFrame;

export type ReplayFrame = BreadcrumbFrame | SpanFrame;

interface RecordingCustomEvent {
  type: EventType.Custom;
  timestamp: number;
  data: {
    tag: string;
    payload: unknown;
  };
}

export interface BreadcrumbFrameEvent extends RecordingCustomEvent {
  data: {
    tag: 'breadcrumb';
    payload: BreadcrumbFrame;
    /**
     * This will indicate to backend to additionally log as a metric
     */
    metric?: boolean;
  };
}

export interface SpanFrameEvent extends RecordingCustomEvent {
  data: {
    tag: 'performanceSpan';
    payload: SpanFrame;
  };
}

export interface OptionFrameEvent extends RecordingCustomEvent {
  data: {
    tag: 'options';
    payload: OptionFrame;
  };
}

export type ReplayFrameEvent = BreadcrumbFrameEvent | SpanFrameEvent | OptionFrameEvent;
