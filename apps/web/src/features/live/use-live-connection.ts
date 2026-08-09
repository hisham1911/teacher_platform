import { useEffect, useState } from 'react';
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { resolveBaseUrl } from '../../data/api-client/endpoints';
import { LIVE_EVENT_NAMES, type LiveSessionState } from '../../types/live';

export type LiveConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface UseLiveConnectionOptions {
  enabled: boolean;
  getAccessToken: () => Promise<string>;
  onState: (state: LiveSessionState) => void;
}

export function useLiveConnection({ enabled, getAccessToken, onState }: UseLiveConnectionOptions) {
  const [status, setStatus] = useState<LiveConnectionStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let disposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl(`${resolveBaseUrl()}/hubs/quiz`, {
        accessTokenFactory: getAccessToken,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build();

    for (const eventName of LIVE_EVENT_NAMES) {
      connection.on(eventName, onState);
    }
    connection.onreconnecting(() => setStatus('reconnecting'));
    connection.onreconnected(() => setStatus('connected'));
    connection.onclose(() => {
      if (!disposed) setStatus('offline');
    });

    setStatus('connecting');
    void connection.start()
      .then(() => {
        if (!disposed) setStatus('connected');
      })
      .catch(() => {
        if (!disposed) setStatus('offline');
      });

    return () => {
      disposed = true;
      for (const eventName of LIVE_EVENT_NAMES) {
        connection.off(eventName, onState);
      }
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, getAccessToken, onState]);

  return status;
}

