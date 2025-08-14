import { useState, useEffect, useCallback } from 'react';
import { saveGlobalData, loadGlobalData } from '../utils/globalSync';

// Hook migliorato per dati in tempo reale con gestione errori
export function useRealTimeData<T>(key: string, initialValue: T) {
  const [data, setData] = useState<T>(() => {
    try {
      // Carica dati esistenti all'avvio con fallback multipli
      const savedData = loadGlobalData(key);
      if (savedData !== null && savedData !== undefined) {
        console.log(`✅ Caricati dati esistenti per ${key}`);
        return savedData;
      }
      
      // Fallback a localStorage diretto
      const localData = localStorage.getItem(key);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          console.log(`📱 Fallback localStorage per ${key}`);
          return parsed;
        } catch (parseError) {
          console.warn(`⚠️ Dati corrotti in localStorage per ${key}, uso default`);
          localStorage.removeItem(key);
        }
      }
      
      console.log(`🆕 Inizializzazione ${key} con valore default`);
      return initialValue;
    } catch (error) {
      console.error(`❌ Errore caricamento ${key}:`, error);
      return initialValue;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateData = useCallback((value: T | ((val: T) => T)) => {
    try {
      setError(null);
      const newValue = value instanceof Function ? value(data) : value;
      
      // Validazione base del nuovo valore
      if (newValue === null || newValue === undefined) {
        console.warn(`⚠️ Tentativo di salvare valore null/undefined per ${key}`);
        return;
      }
      
      // Aggiorna stato locale
      setData(newValue);
      
      // Salva globalmente con gestione errori
      const saved = saveGlobalData(key, newValue);
      if (saved) {
        console.log(`💾 ${key} salvato e sincronizzato`);
      } else {
        console.error(`❌ Errore salvataggio ${key}`);
        setError(`Errore salvataggio ${key}`);
        
        // Fallback: salva almeno in localStorage
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
          localStorage.setItem(`${key}_backup`, JSON.stringify(newValue));
        } catch (fallbackError) {
          console.error(`❌ Fallback localStorage fallito per ${key}:`, fallbackError);
        }
      }
    } catch (error) {
      console.error(`❌ Errore updateData per ${key}:`, error);
      setError(`Errore aggiornamento ${key}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }, [key, data]);

  // Listener per sincronizzazione cross-device con gestione errori
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const newData = JSON.parse(e.newValue);
          setData(newData);
          setError(null);
          console.log(`🔄 ${key} sincronizzato da storage event`);
        } catch (error) {
          console.error(`❌ Errore parsing storage event per ${key}:`, error);
          setError(`Errore sincronizzazione ${key}`);
        }
      }
    };

    // Listener per BroadcastChannel con gestione errori
    let channel: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('warzone-sync');
        channel.onmessage = (event) => {
          try {
            if (event.data.type === 'data-update' && event.data.key === key) {
              const newData = JSON.parse(event.data.value);
              setData(newData);
              setError(null);
              console.log(`📡 ${key} sincronizzato via broadcast`);
            }
          } catch (error) {
            console.error(`❌ Errore broadcast per ${key}:`, error);
          }
        };
        
        channel.onerror = (error) => {
          console.error(`❌ Errore BroadcastChannel per ${key}:`, error);
        };
      }
    } catch (error) {
      console.warn(`⚠️ BroadcastChannel non disponibile per ${key}:`, error);
    }

    // Validazione periodica dei dati
    const validationInterval = setInterval(() => {
      try {
        const currentData = localStorage.getItem(key);
        if (currentData) {
          JSON.parse(currentData); // Test parsing
        }
      } catch (error) {
        console.warn(`🧹 Rilevati dati corrotti per ${key}, ripristino backup`);
        const backup = localStorage.getItem(`${key}_backup`);
        if (backup) {
          try {
            const backupData = JSON.parse(backup);
            localStorage.setItem(key, backup);
            setData(backupData);
            console.log(`🔄 Ripristinato backup per ${key}`);
          } catch (backupError) {
            console.error(`❌ Backup corrotto per ${key}:`, backupError);
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}_backup`);
            setData(initialValue);
          }
        }
      }
    }, 30000); // Controllo ogni 30 secondi

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        try {
          channel.close();
        } catch (error) {
          console.warn(`⚠️ Errore chiusura BroadcastChannel:`, error);
        }
      }
      clearInterval(validationInterval);
    };
  }, [key, initialValue]);

  // Funzione di recovery per dati corrotti
  const recoverData = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Prova a recuperare da backup
      const backup = localStorage.getItem(`${key}_backup`);
      if (backup) {
        const backupData = JSON.parse(backup);
        setData(backupData);
        localStorage.setItem(key, backup);
        console.log(`🔄 Dati recuperati da backup per ${key}`);
        return;
      }
      
      // Se non c'è backup, usa valore iniziale
      setData(initialValue);
      saveGlobalData(key, initialValue);
      console.log(`🆕 Reset a valore iniziale per ${key}`);
    } catch (error) {
      console.error(`❌ Errore recovery per ${key}:`, error);
      setData(initialValue);
    } finally {
      setIsLoading(false);
    }
  }, [key, initialValue]);

  return [data, updateData, { isLoading, error, recoverData }] as const;
}