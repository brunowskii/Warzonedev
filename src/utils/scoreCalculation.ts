// Utility per calcoli di punteggio sicuri e testabili

export interface ScoreCalculationInput {
  kills: number;
  position: number;
  multipliers: Record<number, number>;
  isManual: boolean;
  manualScore?: number;
}

export interface ScoreCalculationResult {
  score: number;
  isValid: boolean;
  errors: string[];
}

/**
 * Calcola il punteggio in modo sicuro e controllato
 * REGOLA CRITICA: Se isManual=true, usa SOLO il manualScore fornito
 */
export function calculateScore(input: ScoreCalculationInput): ScoreCalculationResult {
  const errors: string[] = [];
  
  // Validazione input
  if (input.kills < 0) {
    errors.push('Kills non può essere negativo');
  }
  
  if (input.position < 1 || input.position > 20) {
    errors.push('Posizione deve essere tra 1 e 20');
  }
  
  if (input.isManual && (input.manualScore === undefined || input.manualScore < 0)) {
    errors.push('Punteggio manuale deve essere specificato e non negativo');
  }
  
  if (errors.length > 0) {
    return {
      score: 0,
      isValid: false,
      errors
    };
  }
  
  let score: number;
  
  if (input.isManual && input.manualScore !== undefined) {
    // MODALITÀ MANUALE: Usa il punteggio inserito direttamente
    score = input.manualScore;
  } else {
    // MODALITÀ AUTOMATICA: Calcola con moltiplicatori
    const multiplier = input.multipliers[input.position] || 1;
    score = input.kills * multiplier;
  }
  
  return {
    score: Math.round(score * 10) / 10, // Arrotonda a 1 decimale
    isValid: true,
    errors: []
  };
}

/**
 * Valida un array di punteggi per consistenza
 */
export function validateScoreConsistency(scores: ScoreCalculationInput[]): string[] {
  const errors: string[] = [];
  
  // Verifica duplicati di posizione
  const positions = scores.map(s => s.position);
  const duplicatePositions = positions.filter((pos, index) => positions.indexOf(pos) !== index);
  
  if (duplicatePositions.length > 0) {
    errors.push(`Posizioni duplicate trovate: ${duplicatePositions.join(', ')}`);
  }
  
  // Verifica range di posizioni
  const maxPosition = Math.max(...positions);
  const minPosition = Math.min(...positions);
  
  if (maxPosition > scores.length) {
    errors.push(`Posizione massima (${maxPosition}) supera il numero di squadre (${scores.length})`);
  }
  
  return errors;
}

/**
 * Test automatici per garantire correttezza
 */
export function runScoreCalculationTests(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;
  
  // Test 1: Calcolo automatico
  const test1 = calculateScore({
    kills: 10,
    position: 1,
    multipliers: { 1: 2.0, 2: 1.8 },
    isManual: false
  });
  
  if (test1.score === 20 && test1.isValid) {
    results.push('✅ Test 1 PASSED: Calcolo automatico (10 kills × 2.0 = 20)');
  } else {
    results.push('❌ Test 1 FAILED: Calcolo automatico non corretto');
    allPassed = false;
  }
  
  // Test 2: Calcolo manuale
  const test2 = calculateScore({
    kills: 10,
    position: 1,
    multipliers: { 1: 2.0 },
    isManual: true,
    manualScore: 15.5
  });
  
  if (test2.score === 15.5 && test2.isValid) {
    results.push('✅ Test 2 PASSED: Calcolo manuale (punteggio diretto = 15.5)');
  } else {
    results.push('❌ Test 2 FAILED: Calcolo manuale non rispettato');
    allPassed = false;
  }
  
  // Test 3: Validazione errori
  const test3 = calculateScore({
    kills: -5,
    position: 1,
    multipliers: { 1: 2.0 },
    isManual: false
  });
  
  if (!test3.isValid && test3.errors.length > 0) {
    results.push('✅ Test 3 PASSED: Validazione errori funziona');
  } else {
    results.push('❌ Test 3 FAILED: Validazione errori non funziona');
    allPassed = false;
  }
  
  // Test 4: Consistenza posizioni
  const test4 = validateScoreConsistency([
    { kills: 10, position: 1, multipliers: {}, isManual: false },
    { kills: 8, position: 1, multipliers: {}, isManual: false } // Posizione duplicata
  ]);
  
  if (test4.length > 0) {
    results.push('✅ Test 4 PASSED: Rilevamento posizioni duplicate');
  } else {
    results.push('❌ Test 4 FAILED: Non rileva posizioni duplicate');
    allPassed = false;
  }
  
  return { passed: allPassed, results };
}