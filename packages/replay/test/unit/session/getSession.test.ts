import {
  MAX_REPLAY_DURATION,
  SESSION_IDLE_EXPIRE_DURATION,
  SESSION_IDLE_PAUSE_DURATION,
  WINDOW,
} from '../../../src/constants';
import * as CreateSession from '../../../src/session/createSession';
import * as FetchSession from '../../../src/session/fetchSession';
import { getSession } from '../../../src/session/getSession';
import { saveSession } from '../../../src/session/saveSession';
import { makeSession } from '../../../src/session/Session';
import type { ReplayContainer, Session, Timeouts } from '../../../src/types';

jest.mock('@sentry/utils', () => {
  return {
    ...(jest.requireActual('@sentry/utils') as { string: unknown }),
    uuid4: jest.fn(() => 'test_session_uuid'),
  };
});

const SAMPLE_OPTIONS = {
  sessionSampleRate: 1.0,
  allowBuffering: false,
};

function createMockSession(when: number = Date.now()) {
  return makeSession({
    id: 'test_session_id',
    segmentId: 0,
    lastActivity: when,
    started: when,
    sampled: 'session',
    shouldRefresh: true,
  });
}

function mockReplay({
  timeouts,
  session,
  stickySession,
  maxReplayDuration = MAX_REPLAY_DURATION,
}: {
  timeouts: Timeouts;
  session?: Session;
  stickySession: boolean;
  maxReplayDuration?: number;
}): ReplayContainer {
  return {
    timeouts,
    session,
    getOptions: () => {
      return {
        stickySession,
        maxReplayDuration,
        _experiments: {
          traceInternals: false,
        },
      };
    },
  } as ReplayContainer;
}

describe('Unit | session | getSession', () => {
  beforeAll(() => {
    jest.spyOn(CreateSession, 'createSession');
    jest.spyOn(FetchSession, 'fetchSession');
    WINDOW.sessionStorage.clear();
  });

  afterEach(() => {
    WINDOW.sessionStorage.clear();
    (CreateSession.createSession as jest.MockedFunction<typeof CreateSession.createSession>).mockClear();
    (FetchSession.fetchSession as jest.MockedFunction<typeof FetchSession.fetchSession>).mockClear();
  });

  it('creates a non-sticky session when one does not exist', function () {
    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: SESSION_IDLE_EXPIRE_DURATION,
        },
        stickySession: false,
      }),
      SAMPLE_OPTIONS,
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).toHaveBeenCalled();

    expect(session).toEqual({
      id: 'test_session_uuid',
      segmentId: 0,
      lastActivity: expect.any(Number),
      sampled: 'session',
      started: expect.any(Number),
      shouldRefresh: true,
    });

    // Should not have anything in storage
    expect(FetchSession.fetchSession()).toBe(null);
  });

  it('creates a non-sticky session, regardless of session existing in sessionStorage', function () {
    saveSession(createMockSession(Date.now() - 10000));

    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: false,
      }),
      SAMPLE_OPTIONS,
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).toHaveBeenCalled();

    expect(session).toBeDefined();
  });

  it('creates a non-sticky session, when one is expired', function () {
    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: false,
        session: makeSession({
          id: 'old_session_id',
          lastActivity: Date.now() - 1001,
          started: Date.now() - 1001,
          segmentId: 0,
          sampled: 'session',
        }),
      }),
      SAMPLE_OPTIONS,
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).toHaveBeenCalled();

    expect(session).toBeDefined();
    expect(session.id).not.toBe('old_session_id');
  });

  it('creates a sticky session when one does not exist', function () {
    expect(FetchSession.fetchSession()).toBe(null);

    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: SESSION_IDLE_EXPIRE_DURATION,
        },
        stickySession: true,
      }),
      {
        sessionSampleRate: 1.0,
        allowBuffering: false,
      },
    );

    expect(FetchSession.fetchSession).toHaveBeenCalled();
    expect(CreateSession.createSession).toHaveBeenCalled();

    expect(session).toEqual({
      id: 'test_session_uuid',
      segmentId: 0,
      lastActivity: expect.any(Number),
      sampled: 'session',
      started: expect.any(Number),
      shouldRefresh: true,
    });

    // Should not have anything in storage
    expect(FetchSession.fetchSession()).toEqual({
      id: 'test_session_uuid',
      segmentId: 0,
      lastActivity: expect.any(Number),
      sampled: 'session',
      started: expect.any(Number),
      shouldRefresh: true,
    });
  });

  it('fetches an existing sticky session', function () {
    const now = Date.now();
    saveSession(createMockSession(now));

    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: true,
      }),
      {
        sessionSampleRate: 1.0,
        allowBuffering: false,
      },
    );

    expect(FetchSession.fetchSession).toHaveBeenCalled();
    expect(CreateSession.createSession).not.toHaveBeenCalled();

    expect(session).toEqual({
      id: 'test_session_id',
      segmentId: 0,
      lastActivity: now,
      sampled: 'session',
      started: now,
      shouldRefresh: true,
    });
  });

  it('fetches an expired sticky session', function () {
    const now = Date.now();
    saveSession(createMockSession(Date.now() - 2000));

    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: true,
      }),
      SAMPLE_OPTIONS,
    );

    expect(FetchSession.fetchSession).toHaveBeenCalled();
    expect(CreateSession.createSession).toHaveBeenCalled();

    expect(session.id).toBe('test_session_uuid');
    expect(session.lastActivity).toBeGreaterThanOrEqual(now);
    expect(session.started).toBeGreaterThanOrEqual(now);
    expect(session.segmentId).toBe(0);
  });

  it('fetches a non-expired non-sticky session', function () {
    const { session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: false,
        session: makeSession({
          id: 'test_session_uuid_2',
          lastActivity: +new Date() - 500,
          started: +new Date() - 500,
          segmentId: 0,
          sampled: 'session',
        }),
      }),
      SAMPLE_OPTIONS,
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).not.toHaveBeenCalled();

    expect(session.id).toBe('test_session_uuid_2');
    expect(session.segmentId).toBe(0);
  });

  it('re-uses the same "buffer" session if it is expired and has never sent a buffered replay', function () {
    const { type, session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: false,
        session: makeSession({
          id: 'test_session_uuid_2',
          lastActivity: +new Date() - MAX_REPLAY_DURATION - 1,
          started: +new Date() - MAX_REPLAY_DURATION - 1,
          segmentId: 0,
          sampled: 'buffer',
        }),
      }),
      {
        ...SAMPLE_OPTIONS,
        allowBuffering: true,
      },
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).not.toHaveBeenCalled();

    expect(type).toBe('saved');
    expect(session.id).toBe('test_session_uuid_2');
    expect(session.sampled).toBe('buffer');
    expect(session.segmentId).toBe(0);
  });

  it('creates a new session if it is expired and it was a "buffer" session that has sent a replay', function () {
    const currentSession = makeSession({
      id: 'test_session_uuid_2',
      lastActivity: +new Date() - MAX_REPLAY_DURATION - 1,
      started: +new Date() - MAX_REPLAY_DURATION - 1,
      segmentId: 0,
      sampled: 'buffer',
    });
    currentSession.shouldRefresh = false;

    const { type, session } = getSession(
      mockReplay({
        timeouts: {
          sessionIdlePause: SESSION_IDLE_PAUSE_DURATION,
          sessionIdleExpire: 1000,
        },
        stickySession: false,
        session: currentSession,
      }),
      { ...SAMPLE_OPTIONS, allowBuffering: true },
    );

    expect(FetchSession.fetchSession).not.toHaveBeenCalled();
    expect(CreateSession.createSession).not.toHaveBeenCalled();

    expect(type).toBe('new');
    expect(session.id).not.toBe('test_session_uuid_2');
    expect(session.sampled).toBe(false);
    expect(session.segmentId).toBe(0);
  });
});
