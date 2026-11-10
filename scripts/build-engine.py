"""Build the actual Doom C engine. Emscripten 4.0.23; no JS renderer fallback."""
from pathlib import Path
import re, subprocess, os, sys
root=Path(__file__).resolve().parents[1]
sdk=root.parent/'tools'/'emsdk'
emcc=Path(os.environ.get('EMCC',str(sdk/'upstream'/'emscripten'/'emcc.py')))
src=root/'vendor'/'doomgeneric'/'doomgeneric'
make=(src/'Makefile').read_text()
names=re.search(r'SRC_DOOM = (.+)',make).group(1).split()
files=[str(src/n.replace('.o','.c')) for n in names if n!='doomgeneric_xlib.o']
# The HTML shell owns all menus and pausing. Disable blocking visual wipes.
p=src/'d_main.c'; s=p.read_text()
if 'TARIKH browser adapter' not in s:
 s=s.replace('void D_Display (void)', 'void D_Display (void)')
 s=s.replace('wipestart = I_GetTime () - 1;', '/* TARIKH browser adapter, 2026-10-29: no blocking wipe. */\n    return;\n    wipestart = I_GetTime () - 1;')
 p.write_text(s)
out=root/'public'/'engine'; out.mkdir(exist_ok=True,parents=True)
cmd=[sys.executable,str(emcc),*files,str(root/'src'/'doom_bridge.c'),'-I'+str(src),'-O2','-DNORMALUNIX','-DLINUX','-D_DEFAULT_SOURCE','-Wno-incompatible-pointer-types','-Wno-int-conversion','-Wno-implicit-function-declaration','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=67108864','-sSTACK_SIZE=2097152','-sMODULARIZE=1','-sEXPORT_ES6=1','-sEXPORT_NAME=createDoom','-sENVIRONMENT=web','-sEXIT_RUNTIME=0','-sFORCE_FILESYSTEM=1','-sEXPORTED_RUNTIME_METHODS=["FS"]','-lm','-o',str(out/'doom.js')]
subprocess.run(cmd,check=True,cwd=root)
