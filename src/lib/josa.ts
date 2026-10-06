/** 받침 유무에 맞는 조사를 붙인다. josa("마카롱", "은", "는") → "마카롱은" (한글이 아니면 받침 없음으로 본다) */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? withFinal : withoutFinal}`;
}
