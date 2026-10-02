"""Export the local kana dictionary for the Node game server."""
import json
import pickle
from pathlib import Path


class DictionaryUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise pickle.UnpicklingError("Only plain dictionary data is supported")


project = Path(__file__).resolve().parents[1]
with (project.parent / "dict.pkl").open("rb") as source:
    dictionary = DictionaryUnpickler(source).load()
if not isinstance(dictionary, dict) or not all(
    isinstance(length, int)
    and isinstance(words, list)
    and all(isinstance(word, str) for word in words)
    for length, words in dictionary.items()
):
    raise ValueError("Expected a dictionary of integer lengths and lists of words")
destination = project / "server/data/dictionary.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(dictionary, ensure_ascii=False), encoding="utf-8")
print(f"Exported {sum(map(len, dictionary.values())):,} readings to {destination}")
