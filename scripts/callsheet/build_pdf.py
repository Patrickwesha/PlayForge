# Eagles week 5 call sheet -> exports/eagles-w5-jax-call-sheet-diagrams.pdf. Run from the repo root, after build_plays:
#   python3 scripts/callsheet/derive.py   (specs drawn from the sheet's own formation lines -> scripts/callsheet/out/derived.json)
#   PLAYS=scripts/callsheet/out/derived.json KEYS=<derived keys> SCALE=2 npx vitest run --config vitest.render.config.mts scripts/render-rams.render.tsx
#   KEYS=<book keys> SCALE=2 ... (the calls with no formation on the sheet)
#   python3 scripts/callsheet/build_pdf.py
import json, pymupdf, os
R='renders/rams-2022'
d=json.load(open('public/rams-2022/plays.json'))
P={p['key']:p for p in d['plays']}
# (sheet call, book key or None, note)
import importlib.util
_sp=importlib.util.spec_from_file_location('sheet','scripts/callsheet/sheet.py'); sheet=importlib.util.module_from_spec(_sp); _sp.loader.exec_module(sheet)
S=sheet.S
FL={c:f for c,k,n,f in sheet.ENTRIES}
DER={p['key']:p for p in json.load(open('scripts/callsheet/out/derived.json'))['plays']}

doc=pymupdf.open()
W,H=612,792
def new_page(): return doc.new_page(width=W, height=H)
pg=new_page()
pg.insert_text((54,80),"Eagles call sheet, Week 5 at Jacksonville",fontsize=20,fontname="helv")
pg.insert_text((54,106),"The plays, drawn from the sheet's formations with the Rams 2022 line work",fontsize=13,fontname="helv")
y=140
intro=["Every diagram is one of the 862 book plays in PlayForge, named with the Green Bay words. The caption gives the",
"sheet's call, then the book play it is drawn from (its name, the book's formation line, the section and page).",
"'Closest in the book' means the book has no play by that word and this is the nearest concept. 'Not in the Rams",
"book' means the call is a Green Bay or Eagles word with no Rams cell. Where the sheet names a formation, the play is",
"drawn from that formation (the book's line work moved onto it); the caption also gives the formation the book uses."]
for line in intro:
    pg.insert_text((54,y),line,fontsize=10,fontname="helv"); y+=14
y+=10
n_found=sum(1 for _,items in S for _,k,_ in items if k)
n_missing=sum(1 for _,items in S for _,k,_ in items if not k)
pg.insert_text((54,y),f"{n_found} diagrams found, {n_missing} calls with no book play.",fontsize=10,fontname="helv"); y+=24
for sec,items in S:
    pg.insert_text((54,y),sec,fontsize=11,fontname="hebo"); y+=14
    for call,k,note in items:
        pg.insert_text((70,y),f"{call.strip()}: {'see diagram' if k else 'no book play'}",fontsize=9,fontname="helv"); y+=12
    y+=4
    if y>740: pg=new_page(); y=60
# diagrams: cropped to their ink, packed down the page
from PIL import Image, ImageChops
C='scripts/callsheet/out/crops'; os.makedirs(C, exist_ok=True)
def cropped(k):
    outp=f"{C}/{k}.png"
    if not os.path.exists(outp):
        im=Image.open(f"{R}/{k}.png").convert('RGB')
        bg=Image.new('RGB', im.size, (255,255,255))
        bbox=ImageChops.difference(im,bg).getbbox() or (0,0,im.size[0],im.size[1])
        pad=24
        box=(max(0,bbox[0]-pad),max(0,bbox[1]-pad),min(im.size[0],bbox[2]+pad),min(im.size[1],bbox[3]+pad))
        im.crop(box).save(outp)
    return outp
for sec,items in S:
    pg=new_page(); pg.insert_text((54,50),sec,fontsize=15,fontname="hebo"); y=70
    for call,k,note in items:
        rk = k + '-sheet' if (k and FL.get(call) and (k + '-sheet') in DER and os.path.exists(f"{R}/{k}-sheet.png")) else k
        has = bool(k and os.path.exists(f"{R}/{rk}.png"))
        if has:
            img=cropped(rk); im=Image.open(img); w,h=im.size
            boxw, boxh = 504, 272
            scale=min(boxw/w, boxh/h); dw, dh = w*scale, h*scale
            need = 44 + dh + 18
        else:
            need = 48
        if y + need > 775:
            pg=new_page(); pg.insert_text((54,50),sec+" (continued)",fontsize=15,fontname="hebo"); y=70
        pg.insert_text((54,y+12),call.strip(),fontsize=11,fontname="hebo")
        if has:
            p=P[k]; f=p['formation']; line=f['ramsLine'] if f else "no formation line"
            if rk != k:
                sf=DER[rk]['formation']; mine=FL[call].title().replace('Rt','Rt').replace('Lt','Lt')
                pg.insert_text((54,y+26),f"{p['name']}   drawn from your {mine} ({sf['name']})   the book draws it from {line}   {p['section'].replace('-',' ')} p.{p['page']} cell {p['cell']}",fontsize=8.5,fontname="helv")
            else:
                pg.insert_text((54,y+26),f"{p['name']}   {line} (the book's formation; the sheet names none)   {p['section'].replace('-',' ')} p.{p['page']} cell {p['cell']}",fontsize=8.5,fontname="helv")
            pg.insert_text((54,y+38),note,fontsize=8.5,fontname="helv")
            x0=54+(boxw-dw)/2
            pg.insert_image(pymupdf.Rect(x0,y+46,x0+dw,y+46+dh), filename=img)
            pg.draw_rect(pymupdf.Rect(54,y+46,54+boxw,y+46+dh), color=(0.85,0.85,0.85), width=0.5)
        else:
            pg.insert_text((54,y+28),note,fontsize=9,fontname="helv")
        y += need
out='exports/eagles-w5-jax-call-sheet-diagrams.pdf'
doc.save(out, garbage=3, deflate=True); print(out, len(doc), 'pages', os.path.getsize(out)//1024, 'KB')
