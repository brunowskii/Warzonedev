import { useState, useEffect } from 'react';
import { saveGlobalData, loadGlobalData } from '../utils/globalSync';

// Hook semplificato per dati in tempo reale con persistenza globale
export function useRealTimeData<T>(key: string, initialValue: T) {
  const [data, setData] = useState<T>(() => {
    // Carica dati esistenti all'avvio
    const savedData = loadGlobalData(key);
    if (savedData !== null) {
      console.log(`✅ Caricati dati esistenti per ${key}`);
      return savedData;
    }
    console.log(`🆕 Inizializzazione ${key} con valore default`);
    return initialValue;
  });

  const updateData = (value: T | ((val: T) => T)) => {
    const newValue = value instanceof Function ? value(data) : value;
    
    // Aggiorna stato locale
    setData(newValue);
    
    // Salva globalmente
    const saved = saveGlobalData(key, newValue);
    if (saved) {
      console.log(`💾 ${key} salvato e sincronizzato`);
    } else {
      console.error(`❌ Errore salvataggio ${key}`);
    }
  };

  // Listener per sincronizzazione cross-device
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const newData = JSON.parse(e.newValue);
          setData(newData);
          console.log(`🔄 ${key} sincronizzato da altro dispositivo`);
        } catch (error) {
          console.error(`❌ Errore sincronizzazione ${key}:`, error);
        }
      }
    };

    // Listener per BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('warzone-sync');
      channel.onmessage = (event) => {
        if (event.data.type === 'data-update' && event.data.key === key) {
          try {
            const newData = JSON.parse(event.data.value);
            setData(newData);
            console.log(`📡 ${key} sincronizzato via broadcast`);
          } catch (error) {
            console.error(`❌ Errore broadcast ${key}:`, error);
          }
        }
      };
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, [key]);

  return [data, updateData] as const;
}