/** "a", "a e b", "a, b e c" */
export function joinPt(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}

/** Normaliza nomes pra comparar: sem acento, minúsculo, só letras e números. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Remove aspas e quebras de linha pra usar em buscas e nomes. */
export function clean(s: string, max = 100): string {
  return s.replace(/["\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
