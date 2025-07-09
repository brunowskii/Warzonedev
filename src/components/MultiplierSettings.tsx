import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, History, User, Clock } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { logAction } from '../utils/auditLogger';

interface MultiplierSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs?: any[];
  setAuditLogs?: any;
  userIdentifier?: string;
  userRole?: 'admin' | 'manager';
}

const DEFAULT_MULTIPLIERS = {
  1: 2.0, 2: 1.8, 3: 1.8, 4: 1.6, 5: 1.6, 6: 1.6,
  7: 1.4, 8: 1.4, 9: 1.4, 10: 1.4, 11: 1.0, 12: 1.0,
  13: 1.0, 14: 1.0, 15: 1.0, 16: 1.0, 17: 1.0, 18: 1.0,
  19: 1.0, 20: 1.0
};

interface MultiplierHistory {
  id: string;
  changes: Record<number, { old: number; new: number }>;
  timestamp: number;
  user: string;
  userType: string;
}

export default function MultiplierSettings({ 
  isOpen, 
  onClose, 
  auditLogs, 
  setAuditLogs, 
  userIdentifier = 'admin', 
  userRole = 'admin' 
}: MultiplierSettingsProps) {
  const [multipliers, setMultipliers] = useLocalStorage('multipliers', DEFAULT_MULTIPLIERS);
  const [tempMultipliers, setTempMultipliers] = useState(multipliers);
  const [history, setHistory] = useLocalStorage<MultiplierHistory[]>('multiplier_history', []);
  const [showHistory, setShowHistory] = useState(false);
  const [killMultiplier, setKillMultiplier] = useState(1.0);
  const [victoryBonus, setVictoryBonus] = useState(0);

  useEffect(() => {
    setTempMultipliers(multipliers);
  }, [multipliers]);
  const handleSave = () => {
    // Calculate changes
    const changes: Record<number, { old: number; new: number }> = {};
    Object.keys(tempMultipliers).forEach(key => {
      const position = Number(key);
      const oldValue = multipliers[position];
      const newValue = tempMultipliers[position];
      if (oldValue !== newValue) {
        changes[position] = { old: oldValue, new: newValue };
      }
    });

    if (Object.keys(changes).length > 0) {
      // Save to history
      const historyEntry: MultiplierHistory = {
        id: `mult-${Date.now()}`,
        changes,
        timestamp: Date.now(),
        user: userIdentifier,
        userType: userRole
      };

      setHistory(prev => [historyEntry, ...prev].slice(0, 50)); // Keep last 50 changes

      // Log action if audit system is available
      if (auditLogs && setAuditLogs) {
        const changeDetails = Object.entries(changes)
          .map(([pos, change]) => `${pos}°: ${change.old} → ${change.new}`)
          .join(', ');
        
        logAction(
          auditLogs,
          setAuditLogs,
          'MULTIPLIERS_UPDATED',
          `Moltiplicatori aggiornati: ${changeDetails}`,
          userIdentifier,
          userRole,
          { changes, killMultiplier, victoryBonus }
        );
      }
    }

    setMultipliers(tempMultipliers);
    onClose();
  };

  const handleReset = () => {
    setTempMultipliers(DEFAULT_MULTIPLIERS);
    setKillMultiplier(1.0);
    setVictoryBonus(0);
  };

  const updateMultiplier = (position: number, value: number) => {
    setTempMultipliers(prev => ({
      ...prev,
      [position]: value
    }));
  };
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white font-mono flex items-center space-x-2">
            <Settings className="w-6 h-6 text-ice-blue" />
            <span>CONFIGURAZIONE MOLTIPLICATORI</span>
          </h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-mono text-sm"
            >
              <History className="w-4 h-4" />
              <span>STORICO</span>
            </button>
            <button
              onClick={onClose}
              className="text-ice-blue/60 hover:text-ice-blue transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Position Multipliers */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4 font-mono">MOLTIPLICATORI PER POSIZIONE</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(tempMultipliers).map(([position, multiplier]) => (
                <div key={position} className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
                  <label className="block text-ice-blue mb-2 font-mono text-sm">
                    {position}° POSTO
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={multiplier}
                    onChange={(e) => updateMultiplier(Number(position), Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-center focus:outline-none focus:border-ice-blue"
                  />
                  <div className="text-center text-ice-blue/60 text-xs mt-1 font-mono">
                    x{multiplier}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Settings */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 font-mono">CONFIGURAZIONI AGGIUNTIVE</h3>
            <div className="space-y-4">
              <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
                <label className="block text-ice-blue mb-2 font-mono text-sm">
                  MOLTIPLICATORE KILL
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={killMultiplier}
                  onChange={(e) => setKillMultiplier(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-center focus:outline-none focus:border-ice-blue"
                />
                <div className="text-center text-ice-blue/60 text-xs mt-1 font-mono">
                  Kills × {killMultiplier}
                </div>
              </div>

              <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
                <label className="block text-ice-blue mb-2 font-mono text-sm">
                  BONUS VITTORIA
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="50"
                  value={victoryBonus}
                  onChange={(e) => setVictoryBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-center focus:outline-none focus:border-ice-blue"
                />
                <div className="text-center text-ice-blue/60 text-xs mt-1 font-mono">
                  +{victoryBonus} punti per 1° posto
                </div>
              </div>

              <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
                <h4 className="text-ice-blue font-mono text-sm mb-2">FORMULA CALCOLO:</h4>
                <div className="text-white font-mono text-xs space-y-1">
                  <div>Punteggio Base = Kills × Moltiplicatore Posizione</div>
                  <div>Punteggio Finale = (Punteggio Base × Kill Mult.) + Bonus</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Section */}
        {showHistory && (
          <div className="mt-6 p-4 bg-black/10 border border-ice-blue/20 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4 font-mono flex items-center space-x-2">
              <History className="w-5 h-5 text-ice-blue" />
              <span>STORICO MODIFICHE</span>
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {history.map((entry) => (
                <div key={entry.id} className="p-3 bg-black/20 border border-ice-blue/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-ice-blue" />
                      <span className="text-ice-blue font-mono text-sm">{entry.user}</span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-mono">
                        {entry.userType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-ice-blue/60 text-xs font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(entry.timestamp)}</span>
                    </div>
                  </div>
                  <div className="text-white font-mono text-sm">
                    {Object.entries(entry.changes).map(([pos, change]) => (
                      <div key={pos} className="text-xs">
                        {pos}° posto: <span className="text-red-400">{change.old}</span> → <span className="text-green-400">{change.new}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center text-ice-blue/60 font-mono py-4">
                  Nessuna modifica registrata
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between space-x-4">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-6 py-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors font-mono"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESET DEFAULT</span>
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500/20 border border-gray-500/50 text-gray-400 rounded-xl hover:bg-gray-500/30 transition-colors font-mono"
            >
              ANNULLA
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-ice-blue to-ice-blue-dark text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(161,224,255,0.5)] hover:scale-105 transition-all duration-300 font-mono"
            >
              <Save className="w-4 h-4" />
              <span>SALVA</span>
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}