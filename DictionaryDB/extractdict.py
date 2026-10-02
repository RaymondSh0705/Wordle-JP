import xml.etree.ElementTree as ET
import pickle


def kata_to_hira(s):
    result = []
    i = 0
    while i < len(s):
        ch = s[i]
        code = ord(ch)
        # Special handling for ヴ + small kana
        if ch == "ヴ":
            # Handle combinations with small vowels or small ya/yu/yo
            if i + 1 < len(s) and s[i+1] in ("ァ", "ィ", "ゥ", "ェ", "ォ", "ャ", "ュ", "ョ"):
                small = s[i+1]
                mapping = {
                    "ァ": "ぁ",
                    "ィ": "ぃ",
                    "ゥ": "ぅ",
                    "ェ": "ぇ",
                    "ォ": "ぉ",
                    "ャ": "ゃ",
                    "ュ": "ゅ",
                    "ョ": "ょ"
                }
                result.append("ゔ" + mapping[small])
                i += 2
                continue
            else:
                # Just plain ヴ → ゔ
                result.append("ゔ")
                i += 1
                continue

        # Normal katakana → hiragana
        elif 0x30A1 <= code <= 0x30F3:
            result.append(chr(code - 0x60))

        # Not katakana → leave alone
        else:
            result.append(ch)

        i += 1
    return "".join(result)

def extract_kana_from_jmdict(path='/Users/raymondshaw/Documents/Japanese Word Bomb/JMdict'):
    """
    Extract all kana readings (<reb>) from a JMdict XML file.
    Returns a Python set of kana strings.
    """

    # Parse the XML (this may take ~5–15 seconds depending on hardware)
    tree = ET.parse(path)
    root = tree.getroot()

    kana_set = set()

    # JMdict structure:
    # <entry>
    #    <r_ele>
    #        <reb>かな</reb>
    #    </r_ele>
    # </entry>
    for entry in root.findall("entry"):
        for reading in entry.findall("r_ele"):
            reb = reading.find("reb")
            if reb is not None:
                word = reb.text.strip()
                word = kata_to_hira(word)
                kana_set.add(word)

    return kana_set

def get_length(kana_set):
    final_dict = {
        4: [],
        5: [],
        6: [],
        7: [],
        8: [],
    }
    for w in kana_set:
        if len(w) in final_dict:
            final_dict[len(w)].append(w)
    return final_dict

def __main__():
    kana_set = extract_kana_from_jmdict()
    dict = get_length(kana_set)
    for k in dict:
        print(len(dict[k]))
    with open("dict.pkl", "wb") as f:
        pickle.dump(dict, f)


if __name__ == "__main__":
    __main__()
