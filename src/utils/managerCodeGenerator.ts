export function generateManagerCode(): string {
  // Avoid confusing characters: 0, O, I, 1
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  let result = 'MGR';
  
  // Generate format: MGRABC123 (avoiding 0, O, I, 1)
  for (let i = 0; i < 3; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  for (let i = 0; i < 3; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return result;
}

export function isManagerCodeUnique(code: string, existingManagers: Record<string, any>): boolean {
  return !Object.values(existingManagers).some((manager: any) => manager.code === code);
}

export function generateUniqueManagerCode(existingManagers: Record<string, any>): string {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    code = generateManagerCode();
    attempts++;
  } while (!isManagerCodeUnique(code, existingManagers) && attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    // Fallback with timestamp
    code = generateManagerCode() + '-' + Date.now().toString().slice(-3);
  }
  
  return code;
}