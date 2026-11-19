# Imports the recorded sound effects (CC0, the gunshots CC BY 3.0) into public/audio/sfx/<name>_<n>.ogg — mono, 32 kHz Vorbis, short.
# Sources (downloaded by hand into one folder, passed as the first argument; see public/licenses/SFX.md):
#   kenney.nl  Impact Sounds, RPG Audio, Interface Sounds, Sci-fi Sounds (CC0)  → impact-sounds/, rpg-audio/, interface-sounds/, sci-fi-sounds/
#   opengameart.org  «Fire Crackling» (CC0) → oga-fire/fire-1.ogg
#   opengameart.org  «Medieval sound effects - weapon impacts» by StillNorthMedia (CC0) → oga-blades/medieval-weapons-impacts.ogg
#   opengameart.org  «Gunshot Sounds» by Vincent Sevedge (CC BY 3.0 per the archive's own notice) → oga-guns/ (optional)
# Usage: python scripts/import-sfx.py <folder>   (needs ffmpeg; imageio-ffmpeg's binary is used when ffmpeg is not on PATH)
import glob, json, os, shutil, subprocess, sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'sfx')
FF = shutil.which('ffmpeg')
if not FF:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()

def find(pattern):
    hits = sorted(glob.glob(os.path.join(SRC, '**', pattern), recursive=True))
    return [h for h in hits if 'Preview' not in h]

# game sound name → source files (a few variations each; one is picked at random per play)
BANK = {
    'step_grass': find('footstep_grass_00[0-4].ogg'),
    'step_dirt': find('footstep0[0-4].ogg'),
    'step_cave': find('footstep_concrete_00[0-4].ogg'),
    'sword': find('knifeSlice*.ogg'),
    'draw': find('drawKnife[1-3].ogg'),
    'enemy_hurt': find('impactPunch_medium_00[0-4].ogg'),
    'enemy_die': find('impactSoft_heavy_00[0-2].ogg'),
    'arrow_hit': find('impactWood_light_00[0-4].ogg'),
    'impact': find('impactPunch_heavy_00[0-4].ogg'),
    'ricochet': find('impactMetal_light_00[0-4].ogg'),
    'pickup': find('handleSmallLeather*.ogg'),
    'dialog': find('tick_00[12].ogg'),
    'dry': find('metalClick.ogg'),
    'reload': find('beltHandle[12].ogg'),
    'bolt': find('metalLatch.ogg'),
    'pulse': find('laserSmall_00[0-4].ogg'),
    'vent': find('forceField_000.ogg'),
    'cloth': find('cloth[1-4].ogg'),
}
FIRE = find('fire-1.ogg')
BLADES = find('medieval-weapons-impacts.ogg')

def enc(src, dst, extra=()):
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', src, *extra, '-ac', '1', '-ar', '32000', '-c:a', 'libvorbis', '-q:a', '3', dst], check=True)

os.makedirs(OUT, exist_ok=True)
for f in glob.glob(os.path.join(OUT, '*.ogg')): os.remove(f)
manifest = {}
for name, files in BANK.items():
    for i, f in enumerate(files[:5]):
        enc(f, os.path.join(OUT, f'{name}_{i}.ogg'))
    manifest[name] = min(len(files), 5)
# Blade on blade: single clashes cut from the montage (the first hits are blade-on-blade pairs), 0.7 s each with a fade.
if BLADES:
    for i, start in enumerate([1.0, 1.83, 2.59, 3.32, 4.21]):
        enc(BLADES[0], os.path.join(OUT, f'block_{i}.ogg'), ['-ss', str(start - .05), '-t', '0.7', '-af', 'afade=t=out:st=0.45:d=0.25'])
    manifest['block'] = 5
# The campfire bed (looped in the game).
if FIRE:
    enc(FIRE[0], os.path.join(OUT, 'fire_0.ogg')); manifest['fire'] = 1
# Gunshots (optional pack, «Gunshot Sounds» by Vincent Sevedge, CC BY 3.0 per the licence inside the archive):
# one bank per weapon — the Mosin recording for the rifle, the shotgun's boom for the flintlock, short pistol cracks for the PPSh.
def gun(name, files_starts, length):
    n = 0
    for f, starts in files_starts:
        src = find(f)
        if not src: continue
        for st in starts:
            enc(src[0], os.path.join(OUT, f'{name}_{n}.ogg'), ['-ss', str(max(0, st - .02)), '-t', str(length), '-af', f'highpass=f=60,afade=t=out:st={length * .6:.2f}:d={length * .4:.2f}'])
            n += 1
    if n: manifest[name] = n
gun('gun_rifle', [('mosin.wav', [0.44, 5.75, 8.47, 11.1])], 1.1)
gun('gun_musket', [('shotty.wav', [0])], 0.7)
gun('gun_smg', [('cz.wav', [2.49]), ('sks.wav', [9.72])], 0.28)
with open(os.path.join(OUT, 'manifest.json'), 'w') as fh: json.dump(manifest, fh, indent=1)
total = sum(os.path.getsize(f) for f in glob.glob(os.path.join(OUT, '*.ogg')))
print(json.dumps(manifest), f'{total // 1024} KB')
