// Validatore per integrità dei dati
export class DataValidator {
  static validateTournament(tournament: any): boolean {
    try {
      return tournament &&
        typeof tournament.id === 'string' &&
        typeof tournament.name === 'string' &&
        typeof tournament.status === 'string' &&
        tournament.settings &&
        typeof tournament.settings.totalMatches === 'number' &&
        typeof tournament.settings.countedMatches === 'number';
    } catch (error) {
      console.error('❌ Errore validazione torneo:', error);
      return false;
    }
  }

  static validateTeam(team: any): boolean {
    try {
      return team &&
        typeof team.id === 'string' &&
        typeof team.name === 'string' &&
        typeof team.code === 'string' &&
        typeof team.tournamentId === 'string';
    } catch (error) {
      console.error('❌ Errore validazione team:', error);
      return false;
    }
  }

  static validateMatch(match: any): boolean {
    try {
      return match &&
        typeof match.id === 'string' &&
        typeof match.teamCode === 'string' &&
        typeof match.tournamentId === 'string' &&
        typeof match.position === 'number' &&
        typeof match.kills === 'number' &&
        typeof match.score === 'number' &&
        match.position >= 1 && match.position <= 20 &&
        match.kills >= 0 &&
        match.score >= 0;
    } catch (error) {
      console.error('❌ Errore validazione match:', error);
      return false;
    }
  }

  static validateAndCleanData<T>(data: T, validator: (item: any) => boolean): T {
    try {
      if (Array.isArray(data)) {
        return data.filter(validator) as T;
      } else if (typeof data === 'object' && data !== null) {
        const cleaned: any = {};
        Object.entries(data).forEach(([key, value]) => {
          if (validator(value)) {
            cleaned[key] = value;
          } else {
            console.warn(`🧹 Rimosso elemento non valido: ${key}`);
          }
        });
        return cleaned as T;
      }
      return data;
    } catch (error) {
      console.error('❌ Errore pulizia dati:', error);
      return data;
    }
  }

  static repairCorruptedData(): void {
    try {
      console.log('🔧 Avvio riparazione dati corrotti...');
      
      // Ripara tournaments
      const tournaments = localStorage.getItem('tournaments');
      if (tournaments) {
        try {
          const parsed = JSON.parse(tournaments);
          const cleaned = this.validateAndCleanData(parsed, this.validateTournament);
          localStorage.setItem('tournaments', JSON.stringify(cleaned));
          console.log('✅ Tournaments riparati');
        } catch (error) {
          console.warn('🧹 Tournaments corrotti, reset...');
          localStorage.removeItem('tournaments');
        }
      }

      // Ripara teams
      const teams = localStorage.getItem('teams');
      if (teams) {
        try {
          const parsed = JSON.parse(teams);
          const cleaned = this.validateAndCleanData(parsed, this.validateTeam);
          localStorage.setItem('teams', JSON.stringify(cleaned));
          console.log('✅ Teams riparati');
        } catch (error) {
          console.warn('🧹 Teams corrotti, reset...');
          localStorage.removeItem('teams');
        }
      }

      // Ripara matches
      const matches = localStorage.getItem('matches');
      if (matches) {
        try {
          const parsed = JSON.parse(matches);
          const cleaned = this.validateAndCleanData(parsed, this.validateMatch);
          localStorage.setItem('matches', JSON.stringify(cleaned));
          console.log('✅ Matches riparati');
        } catch (error) {
          console.warn('🧹 Matches corrotti, reset...');
          localStorage.removeItem('matches');
        }
      }

      console.log('✅ Riparazione dati completata');
    } catch (error) {
      console.error('❌ Errore riparazione dati:', error);
    }
  }
}

// Funzione di utilità per riparazione automatica
export function autoRepairData(): void {
  try {
    DataValidator.repairCorruptedData();
  } catch (error) {
    console.error('❌ Errore auto-repair:', error);
  }
}