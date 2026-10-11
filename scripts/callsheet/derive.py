"""Derive a spec per call-sheet entry drawn from the sheet's own formation line (the book's cell lends its line work)."""
import json, sys, os, importlib.util
sys.path.insert(0, 'scripts/rams')
os.chdir('.')
import build_plays as bp
spec = importlib.util.spec_from_file_location('bpdf', 'scripts/callsheet/sheet.py')
sheet = importlib.util.module_from_spec(spec); spec.loader.exec_module(sheet)
d = json.load(open('public/rams-2022/plays.json'))
P = {p['key']: p for p in d['plays']}
pack = bp.load_pack()
out = []
for call, k, note, fline in sheet.ENTRIES:
    if not k or not fline:
        continue
    p = json.loads(json.dumps(P[k]))
    form = bp.parse_formation(fline, p['section'])
    # the sheet's words are the system's own: Open is the Green Bay Open (Y flexes off into the slot), not the Rams word
    form['tags'] = ['Open' if t == 'Out' and ' OPEN' in fline.upper() else t for t in form['tags']]
    form['name'] = form['name'].replace(' Out', ' Open') if ' OPEN' in fline.upper() else form['name']
    personnel = form.get('personnel') or []
    cand = pack.get(form['name'].upper()) or pack.get(form['name'].upper().replace(' LT ', ' RT ').replace(' LT', ' RT'))
    backs = (personnel or ['11'])[0][0]
    order = lambda keys: (personnel or []) + sorted(keys, key=lambda kk: (kk[0] != backs, kk))
    pack_key = pack_pers = base_key = None
    if cand:
        for pp in order(list(cand.keys())):
            if pp in cand:
                pack_key, pack_pers = cand[pp], pp; break
    base_cand = pack.get((form['base'] + ' Rt').upper())
    if base_cand:
        for pp in order(list(base_cand.keys())):
            if pp in base_cand:
                base_key = base_cand[pp]; break
    p.update({'key': k + '-sheet', 'formation': form, 'packKey': pack_key, 'packPersonnel': pack_pers, 'baseKey': base_key, 'personnel': (personnel or [None])[0], 'formationIsCalled': True})
    print(k, '->', form['name'], 'pack', pack_key, 'base', base_key, 'tags', form['tags'], 'unknown', form['unknown'])
    out.append(p)
json.dump({**{kk: v for kk, v in d.items() if kk != 'plays'}, 'plays': out}, open('scripts/callsheet/out/derived.json', 'w'))
print(len(out), 'derived')
