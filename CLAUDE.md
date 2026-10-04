@AGENTS.md

# Source material and handoff

The playbooks this project is built from are copyrighted and are NOT in this repo. They live in the private
repo `Patrickwesha/playforge-source`, which belongs in this checkout as `source/` (gitignored here):

```bash
git clone https://github.com/Patrickwesha/playforge-source.git source
mkdir -p public/book/gb-2019 && cp source/public-book/gb-2019/*.json public/book/gb-2019/
```

Read `source/HANDOFF.md` first, then `source/handoff/project_playforge.md`: the owner's rules, every decision
so far, and what is open. Never copy book text, PDFs or page images into this repo: only paraphrases,
positions, names and page numbers.
