const KANA_ROWS = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', '', '', 'を'],
  ['ん', '', '', '', ''],
  ['ゃ', '', 'ゅ', '', 'ょ'],
  ['っ', 'ー', '', '', ''],
];

const STATUS_LABELS = {
  absent: 'not in the word',
  present: 'in the word, wrong position',
  correct: 'correct position',
};

export default function KanaKeyboard({ statuses }) {
  // Keep the requested layout; show any additional guessed kana below it.
  const extras = Object.keys(statuses).filter((kana) => !KANA_ROWS.flat().includes(kana));
  const rows = [...KANA_ROWS];
  for (let i = 0; i < extras.length; i += 5) {
    rows.push(Array.from({ length: 5 }, (_, index) => extras[i + index] ?? ''));
  }
  return (
    <aside className="kana-keyboard" aria-label="Japanese keyboard feedback">
      <table className="kana-table">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((kana, column) => (
                <td key={column} className={kana ? `kana-key ${statuses[kana] ?? ''}` : 'kana-gap'}>
                  {kana && <span aria-label={`${kana}: ${STATUS_LABELS[statuses[kana]] ?? 'not guessed'}`}>
                    {kana}
                  </span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="keyboard-legend">
        <li><span className="legend-swatch correct" />Correct position</li>
        <li><span className="legend-swatch present" />Wrong position</li>
        <li><span className="legend-swatch absent" />Not in word</li>
      </ul>
    </aside>
  );
}
