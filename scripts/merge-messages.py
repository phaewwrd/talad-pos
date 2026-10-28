"""Deep-merge a JSON patch {"th": {...}, "en": {...}} into messages/*.json.
Usage: python3 scripts/merge-messages.py patch.json"""
import json, sys

def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v

patch = json.load(open(sys.argv[1]))
for locale, data in patch.items():
    path = f"messages/{locale}.json"
    msgs = json.load(open(path))
    merge(msgs, data)
    with open(path, "w") as f:
        json.dump(msgs, f, ensure_ascii=False, indent=2)
        f.write("\n")
th, en = (json.load(open(f"messages/{l}.json")) for l in ("th", "en"))
def keys(d, p=""):
    return {p + k for k, v in d.items() for k in ([k] if not isinstance(v, dict) else [])} | {x for k, v in d.items() if isinstance(v, dict) for x in keys(v, p + k + ".")}
missing = keys(th) ^ keys(en)
if missing:
    print("KEY MISMATCH:", sorted(missing)); sys.exit(1)
print("ok", len(keys(th)), "keys")
