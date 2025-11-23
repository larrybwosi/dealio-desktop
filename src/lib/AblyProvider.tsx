import React, { createContext, useContext, useEffect, useState } from 'react';
import Ably from 'ably';
import { toast } from 'sonner';
import { DetailedToast, NotificationType } from '@/components/DetailedToast';

interface AblyContextType {
  client: Ably.Realtime | null;
  isConnected: boolean;
}

const AblyContext = createContext<AblyContextType>({
  client: null,
  isConnected: false,
});

export const useAbly = () => useContext(AblyContext);

interface AblyProviderProps {
  children: React.ReactNode;
}

export const AblyProvider: React.FC<AblyProviderProps> = ({ children }) => {
  const [client, setClient] = useState<Ably.Realtime | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_ABLY_API_KEY;

    if (!apiKey) {
      console.warn('Ably API key not found. Real-time notifications will be disabled.');
      return;
    }

    const ably = new Ably.Realtime({ key: apiKey });

    ably.connection.on('connected', () => {
      console.log('Connected to Ably');
      setIsConnected(true);
    });

    ably.connection.on('disconnected', () => {
      console.log('Disconnected from Ably');
      setIsConnected(false);
    });

    ably.connection.on('failed', () => {
      console.error('Failed to connect to Ably');
      setIsConnected(false);
    });

    setClient(ably);

    // Subscribe to a global notifications channel
    const channel = ably.channels.get('pos-notifications');

    channel.subscribe('notification', (message) => {
      const data = message.data as {
        title: string;
        message: string;
        type?: NotificationType;
        action?: { label: string; onClick: () => void };
      };

      toast.custom((id) => (
        <DetailedToast
          id={id}
          title={data.title}
          message={data.message}
          type={data.type || 'info'}
          timestamp={new Date().toLocaleTimeString()}
          action={data.action}
        />
      ));
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, []);

  return (
    <AblyContext.Provider value={{ client, isConnected }}>
      {children}
    </AblyContext.Provider>
  );
};
