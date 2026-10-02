// Normalize voiced kana and convert katakana to hiragana before counting tiles.
export function normalizeGuess(value) {
  return value.normalize('NFKC').replace(/[ァ-ヶ]/g, (kana) =>
    String.fromCharCode(kana.charCodeAt(0) - 0x60));
}

export function splitKana(value) {
  // Match the Python dictionary: every normalized kana has its own tile.
  return Array.from(normalizeGuess(value));
}
