"""Pack the built book for deployment: gzip + AES-256-GCM, so the copyrighted content can sit in the public
repo unreadable, and only a deployment holding the key (BOOK_KEY) can serve it.

  python scripts/playbook/pack_book.py

In:  public/book/gb-2019/book.json, library.json
Out: data/book/gb-2019.book.enc, data/book/gb-2019.library.enc   (committed)
Key: source/book/book.key (hex, 32 bytes; created on the first run, gitignored). Paste it into Vercel as BOOK_KEY.

Format: 12-byte nonce | ciphertext | 16-byte GCM tag, over gzip(json). Decrypted by src/book/loadBook.ts.
"""
import gzip
import json
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_PATH = os.path.join("source", "book", "book.key")
OUT_DIR = os.path.join("data", "book")
os.makedirs(OUT_DIR, exist_ok=True)

if os.path.exists(KEY_PATH):
    key = bytes.fromhex(open(KEY_PATH).read().strip())
else:
    key = secrets.token_bytes(32)
    with open(KEY_PATH, "w") as f:
        f.write(key.hex())
    print(f"new key written to {KEY_PATH}: set it in Vercel as BOOK_KEY")

for name in ("book", "library"):
    src = os.path.join("public", "book", "gb-2019", f"{name}.json")
    raw = open(src, "rb").read()
    json.loads(raw)  # must be valid before it is sealed
    packed = gzip.compress(raw, compresslevel=9)
    nonce = secrets.token_bytes(12)
    sealed = AESGCM(key).encrypt(nonce, packed, None)
    out = os.path.join(OUT_DIR, f"gb-2019.{name}.enc")
    with open(out, "wb") as f:
        f.write(nonce + sealed)
    print(f"{out}: {len(raw) / 1e6:.1f} MB json -> {len(sealed) / 1e6:.2f} MB sealed")
