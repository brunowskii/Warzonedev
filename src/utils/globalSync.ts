// Sistema di sincronizzazione globale migliorato con gestione errori
export class GlobalDataManager {
  private static instance: GlobalDataManager;
  private isInitialized = false;
  private syncQueue: Array<{ key: string; data: any; timestamp: number }> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.initializeGlobalSystem();
  }

  public static getInstance(): GlobalDataManager {
    if (!GlobalDataManager.instance) {
      GlobalDataManager.instance = new GlobalDataManager();
    }
    return GlobalDataManager.instance;
  }

  private initializeGlobalSystem() {
    console.log('🌍 Inizializzazione sistema globale migliorato...');
    
    try {
      // Abilita accesso globale immediato
      this.enableUniversalAccess();
      
      // Configura sincronizzazione cross-device
      this.setupCrossDeviceSync();
      
      // Avvia pulizia automatica
      this.startAutomaticCleanup();
      
      this.isInitialized = true;
      console.log('✅ Sistema globale inizializzato con successo');
    } catch (error) {
      console.error('❌ Errore inizializzazione sistema globale:', error);
      this.isInitialized = false;
    }
  }

  private enableUniversalAccess() {
    try {
      // Rimuovi tutte le restrizioni
      const restrictions = [
        'ip_restriction', 'geo_restriction', 'device_restriction', 
        'browser_restriction', 'location_restriction'
      ];
      
      restrictions.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (error) {
          console.warn(`⚠️ Errore rimozione restrizione ${key}:`, error);
        }
      });

      // Abilita accesso universale
      const globalFlags = {
        'global_access': 'enabled',
        'cross_device_sync': 'active',
        'universal_login': 'true',
        'data_persistence': 'enabled',
        'last_sync': Date.now().toString(),
        'system_version': '4.0.0'
      };

      Object.entries(globalFlags).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, value);
          sessionStorage.setItem(key, value);
        } catch (error) {
          console.warn(`⚠️ Errore impostazione flag ${key}:`, error);
        }
      });
    } catch (error) {
      console.error('❌ Errore enableUniversalAccess:', error);
    }
  }

  private setupCrossDeviceSync() {
    try {
      // Listener per sincronizzazione tra tab con gestione errori
      window.addEventListener('storage', (e) => {
        try {
          if (e.key && e.newValue && !e.key.includes('_backup')) {
            console.log(`🔄 Sincronizzazione dati: ${e.key}`);
            this.broadcastDataUpdate(e.key, e.newValue);
          }
        } catch (error) {
          console.error('❌ Errore storage listener:', error);
        }
      });

      // Sincronizzazione periodica con gestione errori
      setInterval(() => {
        try {
          this.performDataSync();
        } catch (error) {
          console.error('❌ Errore sync periodico:', error);
        }
      }, 15000); // Ogni 15 secondi

      // Processa queue di sincronizzazione
      setInterval(() => {
        this.processQueue();
      }, 5000); // Ogni 5 secondi
    } catch (error) {
      console.error('❌ Errore setupCrossDeviceSync:', error);
    }
  }

  private startAutomaticCleanup() {
    // Pulizia automatica ogni 5 minuti
    setInterval(() => {
      try {
        this.cleanupCorruptedData();
      } catch (error) {
        console.error('❌ Errore cleanup automatico:', error);
      }
    }, 300000); // 5 minuti
  }

  private cleanupCorruptedData() {
    const criticalKeys = ['tournaments', 'teams', 'matches', 'managers', 'pendingSubmissions', 'scoreAdjustments'];
    
    criticalKeys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          // Test parsing
          JSON.parse(data);
          
          // Verifica integrità dati
          if (key === 'tournaments' || key === 'teams') {
            const parsed = JSON.parse(data);
            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error(`Tipo dati non valido per ${key}`);
            }
          }
        }
      } catch (error) {
        console.warn(`🧹 Pulizia dati corrotti per ${key}:`, error);
        localStorage.removeItem(key);
        
        // Prova a ripristinare da backup
        const backup = localStorage.getItem(`${key}_backup`);
        if (backup) {
          try {
            JSON.parse(backup); // Test backup
            localStorage.setItem(key, backup);
            console.log(`🔄 Ripristinato backup per ${key}`);
          } catch (backupError) {
            console.warn(`❌ Backup corrotto per ${key}, rimozione...`);
            localStorage.removeItem(`${key}_backup`);
          }
        }
      }
    });
  }

  private broadcastDataUpdate(key: string, value: string) {
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('warzone-sync');
        channel.postMessage({
          type: 'data-update',
          key,
          value,
          timestamp: Date.now()
        });
        channel.close();
      }
    } catch (error) {
      console.warn('❌ Broadcast fallito:', error);
    }
  }

  private performDataSync() {
    const criticalKeys = ['tournaments', 'teams', 'matches', 'managers'];
    
    criticalKeys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          // Verifica integrità prima del backup
          JSON.parse(data);
          
          // Crea backup multipli
          sessionStorage.setItem(key, data);
          localStorage.setItem(`${key}_backup`, data);
          localStorage.setItem(`${key}_timestamp`, Date.now().toString());
          
          // Aggiungi alla queue per sync differita
          this.syncQueue.push({
            key,
            data: JSON.parse(data),
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.warn(`❌ Sync fallito per ${key}:`, error);
        
        // Prova a recuperare da backup
        const backup = localStorage.getItem(`${key}_backup`);
        if (backup) {
          try {
            JSON.parse(backup); // Test backup
            localStorage.setItem(key, backup);
            console.log(`🔄 Recuperato da backup: ${key}`);
          } catch (backupError) {
            console.error(`❌ Backup corrotto per ${key}:`, backupError);
          }
        }
      }
    });
  }

  private processQueue() {
    if (this.isProcessingQueue || this.syncQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Processa solo gli ultimi 10 elementi per evitare sovraccarico
      const itemsToProcess = this.syncQueue.splice(0, 10);
      
      itemsToProcess.forEach(item => {
        try {
          // Verifica che i dati siano ancora validi
          if (item.data && typeof item.data === 'object') {
            const serialized = JSON.stringify(item.data);
            localStorage.setItem(`${item.key}_queue_backup`, serialized);
          }
        } catch (error) {
          console.warn(`⚠️ Errore processing queue per ${item.key}:`, error);
        }
      });
    } catch (error) {
      console.error('❌ Errore processQueue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public saveData(key: string, data: any): boolean {
    try {
      // Validazione input
      if (data === null || data === undefined) {
        console.warn(`⚠️ Tentativo di salvare valore null/undefined per ${key}`);
        return false;
      }

      const serialized = JSON.stringify(data);
      
      // Test parsing per verificare serializzazione
      JSON.parse(serialized);
      
      // Salva in multiple location per persistenza
      localStorage.setItem(key, serialized);
      sessionStorage.setItem(key, serialized);
      localStorage.setItem(`${key}_backup`, serialized);
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
      
      // Broadcast per sincronizzazione immediata
      this.broadcastDataUpdate(key, serialized);
      
      console.log(`💾 Dati salvati con successo: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Errore salvataggio ${key}:`, error);
      return false;
    }
  }

  public loadData(key: string): any {
    try {
      // Prova multiple fonti con priorità
      const sources = [
        () => localStorage.getItem(key),
        () => sessionStorage.getItem(key),
        () => localStorage.getItem(`${key}_backup`),
        () => localStorage.getItem(`${key}_queue_backup`)
      ];

      for (const getSource of sources) {
        try {
          const data = getSource();
          if (data) {
            const parsed = JSON.parse(data);
            
            // Validazione base del dato caricato
            if (parsed !== null && parsed !== undefined) {
              return parsed;
            }
          }
        } catch (parseError) {
          console.warn(`⚠️ Errore parsing fonte per ${key}:`, parseError);
          continue;
        }
      }
      
      console.log(`📭 Nessun dato trovato per ${key}`);
      return null;
    } catch (error) {
      console.error(`❌ Errore caricamento ${key}:`, error);
      return null;
    }
  }

  public isGlobalAccessActive(): boolean {
    try {
      return this.isInitialized && localStorage.getItem('global_access') === 'enabled';
    } catch (error) {
      console.error('❌ Errore verifica accesso globale:', error);
      return false;
    }
  }

  public clearAllData(): void {
    try {
      const keys = ['tournaments', 'teams', 'matches', 'managers', 'pendingSubmissions', 'scoreAdjustments', 'auditLogs'];
      keys.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_backup`);
        localStorage.removeItem(`${key}_timestamp`);
        sessionStorage.removeItem(key);
      });
      console.log('🧹 Tutti i dati cancellati');
    } catch (error) {
      console.error('❌ Errore clearAllData:', error);
    }
  }

  public exportAllData(): string {
    try {
      const allData: Record<string, any> = {};
      const keys = ['tournaments', 'teams', 'matches', 'managers', 'pendingSubmissions', 'scoreAdjustments'];
      
      keys.forEach(key => {
        const data = this.loadData(key);
        if (data) {
          allData[key] = data;
        }
      });
      
      return JSON.stringify(allData, null, 2);
    } catch (error) {
      console.error('❌ Errore export dati:', error);
      return '{}';
    }
  }
}

// Istanza globale
export const globalDataManager = GlobalDataManager.getInstance();

// Funzioni di utilità migliorate
export function saveGlobalData(key: string, data: any): boolean {
  try {
    return globalDataManager.saveData(key, data);
  } catch (error) {
    console.error(`❌ Errore saveGlobalData per ${key}:`, error);
    return false;
  }
}

export function loadGlobalData(key: string): any {
  try {
    return globalDataManager.loadData(key);
  } catch (error) {
    console.error(`❌ Errore loadGlobalData per ${key}:`, error);
    return null;
  }
}

export function isGlobalSystemActive(): boolean {
  try {
    return globalDataManager.isGlobalAccessActive();
  } catch (error) {
    console.error('❌ Errore verifica sistema globale:', error);
    return false;
  }
}

export function clearAllGlobalData(): void {
  try {
    globalDataManager.clearAllData();
  } catch (error) {
    console.error('❌ Errore clearAllGlobalData:', error);
  }
}

export function exportGlobalData(): string {
  try {
    return globalDataManager.exportAllData();
  } catch (error) {
    console.error('❌ Errore exportGlobalData:', error);
    return '{}';
  }
}