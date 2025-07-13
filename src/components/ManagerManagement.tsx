import React, { useState } from 'react';
import { UserPlus, Trash2, Eye, EyeOff, Shield, Key, Users, Copy, Check, Lock, Unlock } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { Manager, AuditLog } from '../types';
import { generateUniqueManagerCode } from '../utils/managerCodeGenerator';
import { logAction } from '../utils/auditLogger';

interface ManagerManagementProps {
  managers: Record<string, Manager>;
  setManagers: (managers: Record<string, Manager> | ((prev: Record<string, Manager>) => Record<string, Manager>)) => void;
  auditLogs: AuditLog[];
  setAuditLogs: (logs: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => void;
}

export default function ManagerManagement({ 
  managers, 
  setManagers, 
  auditLogs, 
  setAuditLogs 
}: ManagerManagementProps) {
  const [managerName, setManagerName] = useState('');
  const [showManagerCode, setShowManagerCode] = useState<{ name: string; code: string } | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const createManager = () => {
    if (!managerName.trim()) return;

    const code = generateUniqueManagerCode(managers);
    const newManager: Manager = {
      id: `mgr-${Date.now()}`,
      name: managerName.trim(),
      code,
      permissions: ['scores', 'pending', 'adjustments', 'multipliers'],
      createdAt: Date.now(),
      createdBy: 'admin',
      isActive: true
    };

    setManagers(prev => ({ ...prev, [code]: newManager }));
    setManagerName('');
    setShowManagerCode({ name: managerName.trim(), code });

    // Log action
    logAction(
      auditLogs,
      setAuditLogs,
      'MANAGER_CREATED',
      `Nuovo gestore creato: ${managerName.trim()} (${code})`,
      'admin',
      'admin',
      { managerCode: code, managerName: managerName.trim() }
    );
  };

  const toggleManagerStatus = (managerCode: string) => {
    const manager = managers[managerCode];
    if (!manager) return;

    const newStatus = !manager.isActive;
    setManagers(prev => ({
      ...prev,
      [managerCode]: { ...manager, isActive: newStatus }
    }));

    // Log action
    logAction(
      auditLogs,
      setAuditLogs,
      'MANAGER_STATUS_CHANGED',
      `Gestore ${manager.name} ${newStatus ? 'attivato' : 'disattivato'}`,
      'admin',
      'admin',
      { managerCode, managerName: manager.name, newStatus }
    );
  };

  const deleteManager = (managerCode: string) => {
    const manager = managers[managerCode];
    if (!manager) return;

    if (!confirm(`Sei sicuro di voler eliminare il gestore ${manager.name}?`)) return;

    setManagers(prev => {
      const newManagers = { ...prev };
      delete newManagers[managerCode];
      return newManagers;
    });

    // Log action
    logAction(
      auditLogs,
      setAuditLogs,
      'MANAGER_DELETED',
      `Gestore eliminato: ${manager.name} (${managerCode})`,
      'admin',
      'admin',
      { managerCode, managerName: manager.name }
    );
  };

  const toggleCodeVisibility = (managerCode: string) => {
    setVisibleCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(managerCode)) {
        newSet.delete(managerCode);
      } else {
        newSet.add(managerCode);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const maskCode = (code: string) => {
    if (code.length <= 4) return '****';
    return code.substring(0, 3) + '*'.repeat(code.length - 3);
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

  const managersList = Object.values(managers);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Create Manager */}
        <GlassPanel className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 font-mono flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-ice-blue" />
            <span>CREA NUOVO GESTORE</span>
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-ice-blue mb-2 font-mono text-sm">Nome Gestore</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Inserisci nome gestore"
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-black/30 border border-ice-blue/40 rounded-xl text-white placeholder-ice-blue/60 focus:outline-none focus:border-ice-blue font-mono text-sm sm:text-base"
              />
            </div>

            <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
              <h3 className="text-ice-blue font-mono text-sm mb-2">PERMESSI INCLUSI:</h3>
              <div className="space-y-1 text-xs text-ice-blue/80 font-mono">
                <div>• Gestione punteggi e partite</div>
                <div>• Approvazione sottomissioni</div>
                <div>• Applicazione penalità/ricompense</div>
                <div>• Modifica moltiplicatori</div>
                <div>• Esportazione dati</div>
              </div>
            </div>

            <button
              onClick={createManager}
              disabled={!managerName.trim()}
              className="w-full py-2 sm:py-3 bg-gradient-to-r from-ice-blue to-ice-blue-dark text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(161,224,255,0.5)] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none font-mono text-sm sm:text-base"
            >
              CREA GESTORE
            </button>
          </div>
        </GlassPanel>

        {/* Managers List */}
        <GlassPanel className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 font-mono flex items-center space-x-2">
            <Users className="w-5 h-5 text-ice-blue" />
            <span>GESTORI ATTIVI ({managersList.filter(m => m.isActive).length})</span>
          </h2>
          
          <div className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto">
            {managersList.map((manager) => (
              <div
                key={manager.code}
                className={`p-4 rounded-lg border transition-all duration-300 animate-fade-in ${
                  manager.isActive
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      manager.isActive
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-white font-bold font-mono">{manager.name}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-ice-blue/60 text-sm font-mono">
                          {visibleCodes.has(manager.code) ? manager.code : maskCode(manager.code)}
                        </span>
                        <button
                          onClick={() => toggleCodeVisibility(manager.code)}
                          className="p-1 text-ice-blue/60 hover:text-ice-blue transition-colors"
                          title={visibleCodes.has(manager.code) ? 'Nascondi codice' : 'Mostra codice'}
                        >
                          {visibleCodes.has(manager.code) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        {visibleCodes.has(manager.code) && (
                          <button
                            onClick={() => copyToClipboard(manager.code)}
                            className="p-1 text-ice-blue/60 hover:text-ice-blue transition-colors"
                            title="Copia codice"
                          >
                            {copiedCode === manager.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleManagerStatus(manager.code)}
                      className={`p-2 rounded-lg transition-colors ${
                        manager.isActive
                          ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30'
                      }`}
                      title={manager.isActive ? 'Disattiva' : 'Attiva'}
                    >
                      {manager.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteManager(manager.code)}
                      className="p-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-ice-blue/60 text-xs font-mono">
                  Creato il {formatTime(manager.createdAt)}
                </div>
              </div>
            ))}
            
            {managersList.length === 0 && (
              <div className="text-center text-ice-blue/60 font-mono py-8">
                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessun gestore creato</p>
                <p className="text-xs mt-2">Crea il primo gestore per delegare la gestione del torneo</p>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Manager Code Display Modal */}
      {showManagerCode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassPanel className="w-full max-w-md p-6 text-center animate-fade-in-up">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 mb-4 relative">
                <Key className="w-8 h-8 text-purple-400" />
                <div className="absolute inset-0 rounded-full bg-purple-400/10 animate-ping" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-mono">
                GESTORE CREATO
              </h2>
              <p className="text-purple-400/80 font-mono">
                Codice generato per: <span className="text-white font-bold">{showManagerCode.name}</span>
              </p>
            </div>

            <div className="mb-6">
              <div className="p-6 bg-black/30 border-2 border-purple-500/50 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-shimmer" />
                <div className="text-3xl font-bold text-purple-400 font-mono tracking-wider mb-2">
                  {showManagerCode.code}
                </div>
                <div className="text-purple-400/60 text-sm font-mono">
                  CODICE ACCESSO GESTORE
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="text-sm text-purple-400/60 font-mono bg-black/20 rounded-lg p-4">
                <div className="mb-2 text-purple-400 font-bold">ISTRUZIONI:</div>
                <div>1. Condividi questo codice con il gestore</div>
                <div>2. Il gestore userà questo codice per accedere</div>
                <div>3. Il codice è valido fino alla disattivazione</div>
              </div>
            </div>

            <button
              onClick={() => setShowManagerCode(null)}
              className="w-full py-3 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors font-mono"
            >
              CHIUDI
            </button>
          </GlassPanel>
        </div>
      )}
    </>
  );
}