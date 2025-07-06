import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Enhanced socket URL configuration for production
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV 
    ? 'http://localhost:5000' 
    : '');

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection with production-ready configuration
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false,
      // Production optimizations
      upgrade: true,
      rememberUpgrade: true,
      // CORS and auth
      withCredentials: true,
      autoConnect: true
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      console.log('🌐 Socket URL:', SOCKET_URL);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      console.error('🔌 Attempted URL:', SOCKET_URL);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔌 Socket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('🔌 Socket reconnection failed after maximum attempts');
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const joinTournament = (tournamentId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-tournament', tournamentId);
      console.log('🏆 Joined tournament:', tournamentId);
    } else {
      console.warn('🔌 Socket not connected, cannot join tournament');
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  const emit = (event: string, ...args: any[]) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, ...args);
    } else {
      console.warn('🔌 Socket not connected, cannot emit event:', event);
    }
  };

  return {
    socket: socketRef.current,
    joinTournament,
    on,
    off,
    emit,
    isConnected: socketRef.current?.connected || false,
    socketUrl: SOCKET_URL
  };
}