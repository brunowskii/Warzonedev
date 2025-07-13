import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Check, Edit3, Users, Trophy, Calculator, Download, Image as ImageIcon, FileText, ChevronDown, ChevronUp, Trash2, Lock, Unlock } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { Team, Match, Tournament } from '../types';
import { logAction } from '../utils/auditLogger';
import html2canvas from 'html2canvas';

interface ScoreAssignmentProps {
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
  setMatches: (matches: Match[] | ((prev: Match[]) => Match[])) => void;
  multipliers: Record<number, number>;
  auditLogs: any[];
  setAuditLogs: any;
  userRole: 'admin' | 'manager';
  userIdentifier: string;
}

interface MatchScoreData {
  teamCode: string;
  teamName: string;
  kills: number;
  position: number;
  score: number;
  isManual: boolean; // Flag per distinguere inserimenti manuali
}

interface MatchEditState {
  [matchNumber: number]: {
    isOpen: boolean;
    scores: MatchScoreData[];
    hasChanges: boolean;
    editMode: 'auto' | 'manual'; // Modalità di editing
  };
}

export default function ScoreAssignment({
  tournament,
  teams,
  matches,
  setMatches,
  multipliers,
  auditLogs,
  setAuditLogs,
  userRole,
  userIdentifier
}: ScoreAssignmentProps) {
  const [editState, setEditState] = useState<MatchEditState>({});
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [bulkKills, setBulkKills] = useState<number>(0);
  const [bulkPosition, setBulkPosition] = useState<number>(1);
  const [bulkScore, setBulkScore] = useState<number>(0);
  const [bulkMode, setBulkMode] = useState<'auto' | 'manual'>('auto');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  const maxMatches = tournament.settings.totalMatches;

  // Verifica permessi - ADMIN E MANAGER possono accedere
  const hasPermission = userRole === 'admin' || userRole === 'manager';

  if (!hasPermission) {
    return (
      <GlassPanel className="p-6 text-center">
        <div className="text-red-400 font-mono">
          <Lock className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl">Accesso Negato</p>
          <p className="text-sm">Solo Admin e Gestori possono assegnare punteggi manualmente</p>
        </div>
      </GlassPanel>
    );
  }

  // Initialize edit state for all matches
  useEffect(() => {
    const initialState: MatchEditState = {};
    
    for (let matchNum = 1; matchNum <= maxMatches; matchNum++) {
      const matchScores: MatchScoreData[] = teams.map(team => {
        const teamMatches = matches.filter(m => 
          m.teamCode === team.code && 
          m.tournamentId === tournament.id &&
          m.status === 'approved'
        ).sort((a, b) => a.submittedAt - b.submittedAt);

        const matchData = teamMatches[matchNum - 1];

        return {
          teamCode: team.code,
          teamName: team.name,
          kills: matchData?.kills || 0,
          position: matchData?.position || 1,
          score: matchData?.score || 0,
          isManual: matchData?.reviewedBy === 'manual' || false // Flag per identificare inserimenti manuali
        };
      });

      initialState[matchNum] = {
        isOpen: false,
        scores: matchScores,
        hasChanges: false,
        editMode: 'auto'
      };
    }

    setEditState(initialState);
  }, [teams, matches, maxMatches, tournament.id]);

  const toggleMatch = (matchNumber: number) => {
    setEditState(prev => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        isOpen: !prev[matchNumber]?.isOpen
      }
    }));
  };

  const toggleEditMode = (matchNumber: number) => {
    setEditState(prev => {
      const currentMode = prev[matchNumber]?.editMode || 'auto';
      const newMode = currentMode === 'auto' ? 'manual' : 'auto';
      
      return {
        ...prev,
        [matchNumber]: {
          ...prev[matchNumber],
          editMode: newMode,
          hasChanges: true
        }
      };
    });
  };

  // CALCOLO CORRETTO: Rispetta la modalità di editing
  const calculateScore = (kills: number, position: number, isManual: boolean, manualScore?: number): number => {
    if (isManual && manualScore !== undefined) {
      // MODALITÀ MANUALE: Usa il punteggio inserito direttamente
      return manualScore;
    } else {
      // MODALITÀ AUTOMATICA: Calcola con moltiplicatori
      const multiplier = multipliers[position] || 1;
      return kills * multiplier;
    }
  };

  const updateTeamScore = (
    matchNumber: number, 
    teamCode: string, 
    field: 'kills' | 'position' | 'score', 
    value: number
  ) => {
    setEditState(prev => {
      const matchData = prev[matchNumber];
      if (!matchData) return prev;

      const editMode = matchData.editMode;
      const updatedScores = matchData.scores.map(score => {
        if (score.teamCode === teamCode) {
          const updated = { ...score, [field]: value };
          
          if (editMode === 'manual') {
            // MODALITÀ MANUALE: Non ricalcolare automaticamente
            updated.isManual = true;
            if (field !== 'score') {
              // Se si modifica kills o position in modalità manuale, 
              // mantieni il punteggio esistente a meno che non sia esplicitamente cambiato
              // updated.score rimane invariato
            }
          } else {
            // MODALITÀ AUTOMATICA: Ricalcola con moltiplicatori
            updated.isManual = false;
            updated.score = calculateScore(updated.kills, updated.position, false);
          }
          
          return updated;
        }
        return score;
      });

      return {
        ...prev,
        [matchNumber]: {
          ...matchData,
          scores: updatedScores,
          hasChanges: true
        }
      };
    });
  };

  const updateTeamManualScore = (matchNumber: number, teamCode: string, score: number) => {
    setEditState(prev => {
      const matchData = prev[matchNumber];
      if (!matchData) return prev;

      const updatedScores = matchData.scores.map(scoreData => {
        if (scoreData.teamCode === teamCode) {
          return {
            ...scoreData,
            score,
            isManual: true
          };
        }
        return scoreData;
      });

      return {
        ...prev,
        [matchNumber]: {
          ...matchData,
          scores: updatedScores,
          hasChanges: true
        }
      };
    });
  };

  const removeTeamScore = (matchNumber: number, teamCode: string) => {
    updateTeamScore(matchNumber, teamCode, 'kills', 0);
    updateTeamScore(matchNumber, teamCode, 'position', 1);
    updateTeamManualScore(matchNumber, teamCode, 0);
  };

  const toggleTeamSelection = (teamCode: string) => {
    setSelectedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamCode)) {
        newSet.delete(teamCode);
      } else {
        newSet.add(teamCode);
      }
      return newSet;
    });
  };

  const applyBulkChanges = (matchNumber: number) => {
    if (selectedTeams.size === 0) return;

    selectedTeams.forEach(teamCode => {
      if (bulkMode === 'manual') {
        // Modalità manuale: applica punteggio diretto
        if (bulkScore > 0) {
          updateTeamManualScore(matchNumber, teamCode, bulkScore);
        }
        if (bulkKills > 0) {
          updateTeamScore(matchNumber, teamCode, 'kills', bulkKills);
        }
        updateTeamScore(matchNumber, teamCode, 'position', bulkPosition);
      } else {
        // Modalità automatica: applica kills e position, calcola score
        if (bulkKills > 0) {
          updateTeamScore(matchNumber, teamCode, 'kills', bulkKills);
        }
        updateTeamScore(matchNumber, teamCode, 'position', bulkPosition);
      }
    });

    setSelectedTeams(new Set());
    setBulkKills(0);
    setBulkPosition(1);
    setBulkScore(0);
  };

  const saveMatchScores = async (matchNumber: number) => {
    const matchData = editState[matchNumber];
    if (!matchData || !matchData.hasChanges) return;

    setIsSaving(true);

    try {
      // Remove existing matches for this match number
      const existingMatchIds = matches
        .filter(m => m.tournamentId === tournament.id)
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .reduce((acc, match, index) => {
          const matchNum = Math.floor(index / teams.length) + 1;
          if (matchNum === matchNumber) {
            acc.push(match.id);
          }
          return acc;
        }, [] as string[]);

      // Create new matches
      const newMatches: Match[] = [];
      const timestamp = Date.now();

      matchData.scores.forEach((scoreData, index) => {
        if (scoreData.kills > 0 || scoreData.position > 1 || scoreData.score > 0) {
          const newMatch: Match = {
            id: `manual-${tournament.id}-${scoreData.teamCode}-${matchNumber}-${timestamp}`,
            position: scoreData.position,
            kills: scoreData.kills,
            score: scoreData.score, // USA IL PUNTEGGIO ESATTO INSERITO
            teamCode: scoreData.teamCode,
            photos: [`manual-entry-${matchNumber}.jpg`],
            status: 'approved',
            submittedAt: timestamp + index,
            reviewedAt: timestamp,
            reviewedBy: scoreData.isManual ? 'manual' : userIdentifier, // Flag per identificare inserimenti manuali
            tournamentId: tournament.id
          };
          newMatches.push(newMatch);
        }
      });

      // Update matches state
      setMatches(prev => {
        const filtered = prev.filter(m => !existingMatchIds.includes(m.id));
        return [...filtered, ...newMatches];
      });

      // Mark as saved
      setEditState(prev => ({
        ...prev,
        [matchNumber]: {
          ...prev[matchNumber],
          hasChanges: false
        }
      }));

      // Log action
      logAction(
        auditLogs,
        setAuditLogs,
        'SCORES_MANUALLY_ASSIGNED',
        `Punteggi assegnati manualmente per Partita ${matchNumber} - ${newMatches.length} squadre aggiornate (Modalità: ${matchData.editMode})`,
        userIdentifier,
        userRole,
        { 
          tournamentId: tournament.id, 
          matchNumber, 
          teamsUpdated: newMatches.length,
          editMode: matchData.editMode,
          scores: matchData.scores.filter(s => s.kills > 0 || s.position > 1 || s.score > 0)
        }
      );

      setSaveMessage('✅ Salvataggio avvenuto con successo!');
      setTimeout(() => setSaveMessage(''), 3000);

    } catch (error) {
      console.error('Error saving scores:', error);
      setSaveMessage('❌ Errore durante il salvataggio');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const exportLeaderboard = async (format: 'image' | 'pdf') => {
    const element = document.getElementById('kanba-leaderboard');
    if (!element) return;

    try {
      if (format === 'image') {
        const canvas = await html2canvas(element, {
          backgroundColor: '#000000',
          scale: 2
        });
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tournament.name.toLowerCase().replace(/\s+/g, '_')}_leaderboard.png`;
        a.click();
      } else {
        const canvas = await html2canvas(element, {
          backgroundColor: '#000000',
          scale: 2
        });
        const imgData = canvas.toDataURL('image/png');
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head><title>Classifica ${tournament.name}</title></head>
              <body style="margin:0;padding:20px;background:#000;color:#fff;">
                <img src="${imgData}" style="max-width:100%;height:auto;" />
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
      }

      logAction(
        auditLogs,
        setAuditLogs,
        'LEADERBOARD_EXPORTED',
        `Classifica esportata in formato ${format.toUpperCase()}`,
        userIdentifier,
        userRole,
        { tournamentId: tournament.id, format }
      );
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getLeaderboard = () => {
    const teamStats: Record<string, any> = {};

    teams.forEach(team => {
      teamStats[team.code] = {
        teamName: team.name,
        teamCode: team.code,
        totalScore: 0,
        matches: 0,
        rank: 0
      };
    });

    matches
      .filter(m => m.tournamentId === tournament.id && m.status === 'approved')
      .forEach(match => {
        if (teamStats[match.teamCode]) {
          teamStats[match.teamCode].totalScore += match.score; // USA IL PUNTEGGIO ESATTO
          teamStats[match.teamCode].matches++;
        }
      });

    const sorted = Object.values(teamStats)
      .filter((team: any) => team.matches > 0)
      .sort((a: any, b: any) => b.totalScore - a.totalScore);

    sorted.forEach((team: any, index) => {
      team.rank = index + 1;
    });

    return sorted;
  };

  const leaderboard = getLeaderboard();

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black';
      case 2: return 'bg-gradient-to-r from-gray-400 to-gray-300 text-black';
      case 3: return 'bg-gradient-to-r from-orange-600 to-orange-400 text-white';
      default: return rank <= 5 ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white' : 'bg-gray-800 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white font-mono flex items-center space-x-2">
            <Calculator className="w-6 h-6 text-ice-blue" />
            <span>ASSEGNA PUNTEGGI</span>
            <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-400 rounded text-sm font-mono">
              {userRole.toUpperCase()}
            </div>
          </h2>
          <div className="flex items-center space-x-3">
            <div className="text-ice-blue font-mono text-sm">
              Torneo: <span className="text-white font-bold">{tournament.name}</span>
            </div>
            {saveMessage && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg font-mono text-sm animate-fade-in">
                <Check className="w-4 h-4" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-ice-blue font-mono">{teams.length}</div>
            <div className="text-ice-blue/60 font-mono text-sm">SQUADRE</div>
          </div>
          <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-ice-blue font-mono">{maxMatches}</div>
            <div className="text-ice-blue/60 font-mono text-sm">PARTITE</div>
          </div>
          <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-ice-blue font-mono">
              {matches.filter(m => m.tournamentId === tournament.id && m.status === 'approved').length}
            </div>
            <div className="text-ice-blue/60 font-mono text-sm">PUNTEGGI</div>
          </div>
          <div className="p-4 bg-black/20 border border-ice-blue/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-ice-blue font-mono">
              {Object.values(editState).filter(state => state.hasChanges).length}
            </div>
            <div className="text-ice-blue/60 font-mono text-sm">MODIFICHE</div>
          </div>
        </div>
      </GlassPanel>

      {/* Match Score Assignment */}
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-white mb-6 font-mono flex items-center space-x-2">
          <Edit3 className="w-5 h-5 text-ice-blue" />
          <span>GESTIONE PUNTEGGI PARTITE</span>
        </h3>

        <div className="space-y-4">
          {Array.from({ length: maxMatches }, (_, i) => i + 1).map(matchNumber => {
            const matchState = editState[matchNumber];
            if (!matchState) return null;

            return (
              <div key={matchNumber} className="border border-ice-blue/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleMatch(matchNumber)}
                  className="w-full p-4 bg-black/20 hover:bg-ice-blue/10 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Trophy className="w-5 h-5 text-ice-blue" />
                    <span className="text-white font-bold font-mono">PARTITA {matchNumber}</span>
                    {matchState.hasChanges && (
                      <div className="px-2 py-1 bg-orange-500/20 border border-orange-500/50 text-orange-400 rounded text-xs font-mono animate-pulse">
                        MODIFICHE NON SALVATE
                      </div>
                    )}
                    <div className={`px-2 py-1 rounded text-xs font-mono border ${
                      matchState.editMode === 'manual' 
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    }`}>
                      {matchState.editMode === 'manual' ? 'MANUALE' : 'AUTOMATICO'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEditMode(matchNumber);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        matchState.editMode === 'manual'
                          ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30'
                          : 'bg-blue-500/20 border border-blue-500/50 text-blue-400 hover:bg-blue-500/30'
                      }`}
                      title={`Modalità: ${matchState.editMode === 'manual' ? 'Manuale' : 'Automatica'}`}
                    >
                      {matchState.editMode === 'manual' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <Settings className="w-4 h-4 text-ice-blue" />
                    {matchState.isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {matchState.isOpen && (
                  <div className="p-6 bg-black/10 animate-fade-in">
                    {/* Mode Explanation */}
                    <div className={`mb-6 p-4 rounded-lg border ${
                      matchState.editMode === 'manual'
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}>
                      <h4 className={`font-mono font-bold mb-2 ${
                        matchState.editMode === 'manual' ? 'text-purple-400' : 'text-blue-400'
                      }`}>
                        MODALITÀ {matchState.editMode === 'manual' ? 'MANUALE' : 'AUTOMATICA'}
                      </h4>
                      <div className="text-ice-blue/80 font-mono text-sm">
                        {matchState.editMode === 'manual' ? (
                          <>• Inserisci direttamente il punteggio finale<br/>• I moltiplicatori NON vengono applicati<br/>• Controllo totale sui valori</>
                        ) : (
                          <>• Punteggio calcolato automaticamente<br/>• Formula: Kills × Moltiplicatore Posizione<br/>• Calcolo basato su regole del torneo</>
                        )}
                      </div>
                    </div>

                    {/* Bulk Actions */}
                    <div className="mb-6 p-4 bg-black/20 border border-ice-blue/20 rounded-lg">
                      <h4 className="text-ice-blue font-mono font-bold mb-3">AZIONI IN BLOCCO</h4>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-ice-blue mb-2 font-mono text-sm">Modalità</label>
                          <select
                            value={bulkMode}
                            onChange={(e) => setBulkMode(e.target.value as 'auto' | 'manual')}
                            className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-sm"
                          >
                            <option value="auto">Automatico</option>
                            <option value="manual">Manuale</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-ice-blue mb-2 font-mono text-sm">Kills</label>
                          <input
                            type="number"
                            value={bulkKills}
                            onChange={(e) => setBulkKills(Number(e.target.value))}
                            min="0"
                            className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-ice-blue mb-2 font-mono text-sm">Posizione</label>
                          <select
                            value={bulkPosition}
                            onChange={(e) => setBulkPosition(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-sm"
                          >
                            {Array.from({ length: 20 }, (_, i) => i + 1).map(pos => (
                              <option key={pos} value={pos}>{pos}° posto</option>
                            ))}
                          </select>
                        </div>
                        {bulkMode === 'manual' && (
                          <div>
                            <label className="block text-ice-blue mb-2 font-mono text-sm">Punteggio</label>
                            <input
                              type="number"
                              value={bulkScore}
                              onChange={(e) => setBulkScore(Number(e.target.value))}
                              min="0"
                              step="0.1"
                              className="w-full px-3 py-2 bg-black/30 border border-ice-blue/40 rounded-lg text-white font-mono text-sm"
                            />
                          </div>
                        )}
                        <div className="flex items-end">
                          <button
                            onClick={() => applyBulkChanges(matchNumber)}
                            disabled={selectedTeams.size === 0}
                            className="w-full py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-mono disabled:opacity-50 text-sm"
                          >
                            APPLICA ({selectedTeams.size})
                          </button>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => setSelectedTeams(new Set())}
                            className="w-full py-2 bg-gray-500/20 border border-gray-500/50 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors font-mono text-sm"
                          >
                            DESELEZIONA
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Team Scores Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-ice-blue/30">
                            <th className="text-left py-3 px-4 text-ice-blue font-mono text-sm">SEL</th>
                            <th className="text-left py-3 px-4 text-ice-blue font-mono text-sm">SQUADRA</th>
                            <th className="text-center py-3 px-4 text-ice-blue font-mono text-sm">KILLS</th>
                            <th className="text-center py-3 px-4 text-ice-blue font-mono text-sm">POSIZIONE</th>
                            <th className="text-center py-3 px-4 text-ice-blue font-mono text-sm">PUNTEGGIO</th>
                            <th className="text-center py-3 px-4 text-ice-blue font-mono text-sm">MODALITÀ</th>
                            <th className="text-center py-3 px-4 text-ice-blue font-mono text-sm">AZIONI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchState.scores.map((scoreData) => (
                            <tr key={scoreData.teamCode} className="border-b border-ice-blue/10 hover:bg-ice-blue/5">
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  checked={selectedTeams.has(scoreData.teamCode)}
                                  onChange={() => toggleTeamSelection(scoreData.teamCode)}
                                  className="w-4 h-4 text-ice-blue bg-black/30 border-ice-blue/40 rounded focus:ring-ice-blue"
                                />
                              </td>
                              <td className="py-3 px-4 text-white font-bold font-mono">
                                {scoreData.teamName}
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="number"
                                  value={scoreData.kills}
                                  onChange={(e) => updateTeamScore(matchNumber, scoreData.teamCode, 'kills', Number(e.target.value))}
                                  min="0"
                                  className="w-20 px-2 py-1 bg-black/30 border border-ice-blue/40 rounded text-white font-mono text-center text-sm"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <select
                                  value={scoreData.position}
                                  onChange={(e) => updateTeamScore(matchNumber, scoreData.teamCode, 'position', Number(e.target.value))}
                                  className="w-24 px-2 py-1 bg-black/30 border border-ice-blue/40 rounded text-white font-mono text-center text-sm"
                                >
                                  {Array.from({ length: 20 }, (_, i) => i + 1).map(pos => (
                                    <option key={pos} value={pos}>{pos}°</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {matchState.editMode === 'manual' ? (
                                  <input
                                    type="number"
                                    value={scoreData.score}
                                    onChange={(e) => updateTeamManualScore(matchNumber, scoreData.teamCode, Number(e.target.value))}
                                    min="0"
                                    step="0.1"
                                    className="w-20 px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-purple-400 font-mono text-center text-sm font-bold"
                                  />
                                ) : (
                                  <span className="text-ice-blue font-mono font-bold">
                                    {scoreData.score.toFixed(1)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className={`px-2 py-1 rounded text-xs font-mono ${
                                  scoreData.isManual 
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                  {scoreData.isManual ? 'MAN' : 'AUTO'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => removeTeamScore(matchNumber, scoreData.teamCode)}
                                  className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                  title="Rimuovi punteggio"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Save Button */}
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => saveMatchScores(matchNumber)}
                        disabled={!matchState.hasChanges || isSaving}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-ice-blue to-ice-blue-dark text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(161,224,255,0.5)] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none font-mono"
                      >
                        <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                        <span>{isSaving ? 'SALVATAGGIO...' : 'SALVA PUNTEGGI'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Kanba Style Leaderboard */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-ice-blue" />
            <span>CLASSIFICA KANBA STYLE</span>
          </h3>
          <div className="flex space-x-3">
            <button
              onClick={() => exportLeaderboard('image')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-mono text-sm"
            >
              <ImageIcon className="w-4 h-4" />
              <span>ESPORTA IMMAGINE</span>
            </button>
            <button
              onClick={() => exportLeaderboard('pdf')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors font-mono text-sm"
            >
              <FileText className="w-4 h-4" />
              <span>ESPORTA PDF</span>
            </button>
          </div>
        </div>

        <div id="kanba-leaderboard" className="bg-black p-8 rounded-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white font-mono mb-2">{tournament.name.toUpperCase()}</h1>
            <div className="text-ice-blue font-mono">CLASSIFICA FINALE</div>
          </div>

          <div className="space-y-2">
            {leaderboard.map((team: any, index) => (
              <div
                key={team.teamCode}
                className={`flex items-center justify-between p-4 rounded-lg font-mono ${getRankColor(team.rank)}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold">#{team.rank}</div>
                  <div>
                    <div className="text-xl font-bold">{team.teamName}</div>
                    <div className="text-sm opacity-80">{team.matches} partite</div>
                  </div>
                </div>
                <div className="text-3xl font-bold">{team.totalScore.toFixed(1)}</div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 text-gray-400 font-mono text-sm">
            © 2025 BM Solution - Advanced Tournament Management System
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}