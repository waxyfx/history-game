from pathlib import Path
import zipfile
r=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(r/'dist'/'tarikh-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in r.rglob('*'):
  rel=p.relative_to(r)
  if not p.is_file() or any(s in ('node_modules','.git','dist','.openai','test-results','screenshots') for s in rel.parts):continue
  if p.name.startswith('.env') and p.name!='.env.example':continue
  if p.suffix in ('.wad','.wasm','.pack','.gz','.pyc') or p.name=='doom.js':continue
  z.write(p,rel)
print('Corresponding source: dist/tarikh-source.zip')
