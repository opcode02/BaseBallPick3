// src/utils/pure-generalUtils.ts
// Pure general utilities without external dependencies

/** Derive initials for placeholder avatar */
export function initials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/ +/);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || '';
  return (first + second).toUpperCase();
}

/** Normalize boosters to always sum to 100 */
export function normalizeBoostersToHundred(
  targetId: number, 
  rawValue: number, 
  pickedIds: number[], 
  currentBoosters: Record<number, number>
): Record<number, number> {
  if (pickedIds.length !== 3) return currentBoosters;
  
  const [a, b, c] = pickedIds;
  const ids = [a, b, c];
  const clamped = Math.max(0, Math.min(100, Math.round(rawValue)));

  const cur = {
    [a]: currentBoosters[a] ?? 0,
    [b]: currentBoosters[b] ?? 0,
    [c]: currentBoosters[c] ?? 0,
  } as Record<number, number>;

  cur[targetId] = clamped;
  const others = ids.filter(id => id !== targetId);
  const remaining = 100 - clamped;

  const otherSum = (currentBoosters[others[0]] ?? 0) + (currentBoosters[others[1]] ?? 0);

  let newOther1 = 0, newOther2 = 0;
  if (otherSum <= 0) {
    newOther1 = Math.floor(remaining / 2);
    newOther2 = remaining - newOther1;
  } else {
    newOther1 = Math.round(remaining * (currentBoosters[others[0]] ?? 0) / otherSum);
    newOther2 = remaining - newOther1;
  }

  const next: Record<number, number> = { ...currentBoosters };
  next[targetId] = clamped;
  next[others[0]] = newOther1;
  next[others[1]] = newOther2;

  return next;
}

/** Validate that boosters are complete */
export function validateBoostersComplete(
  pickedIds: number[], 
  boosters: Record<number, number>
): boolean {
  const boosterUsed = pickedIds.reduce((sum, id) => sum + (boosters[id] ?? 0), 0);
  return pickedIds.length === 3 && 
         boosterUsed === 100 && 
         pickedIds.every(id => Number.isFinite(boosters[id]));
}
