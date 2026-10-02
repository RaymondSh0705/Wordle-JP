import { KANA_ROWS } from './keyboardLayout.js';

const STATUS_LABELS = {
  absent: 'not in the word',
  present: 'in the word, wrong position',
  correct: 'correct position',
};

export default function KanaKeyboard({ statuses, bubble = false }) {
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
                  {kana && <span aria-label={`${kana}: ${bubble && statuses[kana] === 'present' ? 'in the word, position not confirmed' : STATUS_LABELS[statuses[kana]] ?? 'not guessed'}`}>
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
        <li><span className="legend-swatch present" />{bubble ? 'In word / position unknown' : 'Wrong position'}</li>
        <li><span className="legend-swatch absent" />Not in word</li>
      </ul>
    </aside>
  );
}
