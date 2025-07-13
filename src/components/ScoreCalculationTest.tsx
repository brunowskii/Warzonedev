import React, { useState } from 'react';
import { TestTube, CheckCircle, XCircle, Play } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { runScoreCalculationTests } from '../utils/scoreCalculation';

interface ScoreCalculationTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoreCalculationTest({ isOpen, onClose }: ScoreCalculationTestProps) {
  const [testResults, setTestResults] = useState<{ passed: boolean; results: string[] } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    
    // Simula tempo di esecuzione per effetto visivo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const results = runScoreCalculationTests();
    setTestResults(results);
    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
            <TestTube className="w-5 h-5 text-ice-blue" />
            <span>TEST CALCOLO PUNTEGGI</span>
          </h2>
          <button
            onClick={onClose}
            className="text-ice-blue/60 hover:text-ice-blue transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
            <h3 className="text-ice-blue font-mono font-bold mb-2">OBIETTIVO DEI TEST:</h3>
            <div className="text-ice-blue/80 font-mono text-sm space-y-1">
              <div>• Verificare calcolo automatico (kills × moltiplicatore)</div>
              <div>• Verificare calcolo manuale (punteggio diretto)</div>
              <div>• Validare input errati (kills negativi, posizioni invalide)</div>
              <div>• Controllare consistenza dati (posizioni duplicate)</div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={runTests}
              disabled={isRunning}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-ice-blue to-ice-blue-dark text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(161,224,255,0.5)] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            >
              <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'ESECUZIONE TEST...' : 'ESEGUI TEST'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-3 animate-fade-in">
              <div className={`p-4 rounded-lg border ${
                testResults.passed 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className={`flex items-center space-x-2 font-mono font-bold ${
                  testResults.passed ? 'text-green-400' : 'text-red-400'
                }`}>
                  {testResults.passed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span>
                    {testResults.passed ? 'TUTTI I TEST SUPERATI' : 'ALCUNI TEST FALLITI'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {testResults.results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border font-mono text-sm ${
                      result.startsWith('✅') 
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>

              {testResults.passed && (
                <div className="p-4 bg-ice-blue/10 border border-ice-blue/30 rounded-lg">
                  <div className="text-ice-blue font-mono font-bold mb-2">✅ SISTEMA VALIDATO</div>
                  <div className="text-ice-blue/80 font-mono text-sm">
                    Il sistema di calcolo punteggi funziona correttamente e rispetta tutte le regole definite.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}