"""Merge vanilla Doom namespaces and optional licensed asset replacements.

No entity states, map geometry or gameplay definitions are changed. Standard
library suffices for raw lumps; PNG conversion optionally uses Pillow.
"""
from pathlib import Path
import argparse
import json
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
NAMESPACES = {"sprite": ("S_START", "S_END"), "flat": ("F_START", "F_END")}
FORBIDDEN = {"THINGS", "LINEDEFS", "SIDEDEFS", "VERTEXES", "SEGS", "SSECTORS", "NODES", "SECTORS", "REJECT", "BLOCKMAP", "PNAMES", "TEXTURE1", "TEXTURE2", "PLAYPAL", "COLORMAP", "DEHACKED"}


def read_wad(path):
    data = Path(path).read_bytes()
    if len(data) < 12 or data[:4] not in (b"IWAD", b"PWAD"):
        raise ValueError("Invalid WAD header")
    count, directory = struct.unpack_from("<ii", data, 4)
    if count < 0 or directory < 12 or directory + count * 16 > len(data):
        raise ValueError("Invalid WAD directory")
    result = []
    for i in range(count):
        offset, length, raw = struct.unpack_from("<ii8s", data, directory + i * 16)
        if offset < 0 or length < 0 or offset + length > len(data):
            raise ValueError("Invalid WAD lump bounds")
        result.append((raw.rstrip(b"\0").decode("ascii"), data[offset:offset + length]))
    return result


def write_wad(path, lumps):
    data = bytearray(b"\0" * 12)
    directory = []
    for name, body in lumps:
        directory.append((len(data), len(body), name))
        data.extend(body)
    offset = len(data)
    for pos, size, name in directory:
        data.extend(struct.pack("<ii8s", pos, size, name.encode("ascii")))
    data[:12] = b"PWAD" + struct.pack("<ii", len(lumps), offset)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_bytes(data)
    temporary.replace(target)


def split_namespaces(lumps):
    sections = {kind: {} for kind in NAMESPACES}
    rest = []
    active = None
    for name, body in lumps:
        if name in ("S_START", "SS_START", "F_START", "FF_START"):
            active = "sprite" if name.startswith("S") else "flat"
            continue
        if name in ("S_END", "SS_END", "F_END", "FF_END"):
            active = None
            continue
        if active:
            # Internal F1_START/F1_END markers are not actual 64x64 flats.
            if re.fullmatch(r"[SF]\d_(START|END)", name):
                continue
            sections[active][name] = body
        else:
            rest.append((name, body))
    return rest, sections


def png_lump(path, kind, palette, entry):
    try:
        from PIL import Image
    except ImportError as error:
        raise ValueError("PNG conversion requires Pillow; run using the bundled Python runtime or install Pillow") from error
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    if not (1 <= width <= 1024 and 1 <= height <= 254):
        raise ValueError("Vanilla patch input must be 1..1024 pixels wide and 1..254 high")
    if kind == "flat" and image.size != (64, 64):
        raise ValueError("A flat must be exactly 64x64 pixels")
    colors = [tuple(palette[i:i+3]) for i in range(0, 768, 3)]
    cache = {}
    def index(pixel):
        rgb = pixel[:3]
        if rgb not in cache:
            cache[rgb] = min(range(256), key=lambda i: sum((a-b)**2 for a, b in zip(rgb, colors[i])))
        return cache[rgb]
    if kind == "flat":
        if any(pixel[3] < 128 for pixel in image.getdata()):
            raise ValueError("Floor and ceiling flats cannot contain transparency")
        return bytes(index(pixel) for pixel in image.getdata())
    left = int(entry.get("leftOffset", width // 2 if kind == "sprite" else 0))
    top = int(entry.get("topOffset", height if kind == "sprite" else 0))
    if not (-32768 <= left <= 32767 and -32768 <= top <= 32767):
        raise ValueError("Invalid patch origin")
    data = bytearray(struct.pack("<hhhh", width, height, left, top) + bytes(width * 4))
    for x in range(width):
        struct.pack_into("<I", data, 8 + x * 4, len(data))
        y = 0
        while y < height:
            if image.getpixel((x, y))[3] < 128:
                y += 1
                continue
            start = y
            pixels = []
            while y < height and image.getpixel((x, y))[3] >= 128:
                pixels.append(index(image.getpixel((x, y))))
                y += 1
            data.extend(bytes((start, len(pixels), 0, *pixels, 0)))
        data.append(255)
    return bytes(data)


def merge_assets(base_lumps, game_lumps, manifest, manifest_dir):
    _, original = split_namespaces(base_lumps)
    rest, custom = split_namespaces(game_lumps)
    for kind in NAMESPACES:
        original[kind].update(custom[kind])
    palette = dict(base_lumps)["PLAYPAL"][:768]
    if manifest.get("version") != 1:
        raise ValueError("Unsupported asset manifest version")
    credits = []
    root = Path(manifest_dir).resolve()
    seen = set()
    for entry in manifest.get("replacements", []):
        name = entry["lump"].upper()
        kind = entry["kind"]
        if not re.fullmatch(r"[A-Z0-9_]{1,8}", name) or name in FORBIDDEN or re.fullmatch(r"MAP\d\d|E\dM\d", name) or name.endswith(("_START", "_END")):
            raise ValueError(f"Unsupported asset lump: {name}")
        if kind not in ("sprite", "flat", "patch") or name in seen:
            raise ValueError(f"Invalid kind or duplicate replacement: {name}")
        seen.add(name)
        if kind == "sprite" and not re.fullmatch(r"[A-Z0-9]{4}[A-Z][0-8]([A-Z][0-8])?", name):
            raise ValueError(f"Sprite name must use Doom frame/rotation convention: {name}")
        if not all(isinstance(entry.get(field), str) and entry[field].strip() for field in ("author", "license", "source")):
            raise ValueError(f"Author, license and source are required: {name}")
        path = (root / entry["file"]).resolve()
        if not path.is_relative_to(root):
            raise ValueError("Asset files must remain inside the manifest folder")
        if entry.get("format", "raw") == "png":
            body = png_lump(path, kind, palette, entry)
        elif entry.get("format", "raw") == "raw":
            body = path.read_bytes()
        else:
            raise ValueError("Asset format must be raw or png")
        if kind == "flat" and len(body) != 4096:
            raise ValueError(f"Raw flat must have 4096 bytes: {name}")
        if kind in NAMESPACES:
            original[kind][name] = body
        else:
            # Existing patch names only: adding a wall texture also requires
            # PNAMES/TEXTURE definitions, which are intentionally map-author work.
            if name not in dict(base_lumps) and name not in dict(rest):
                raise ValueError(f"Patch must replace an existing name: {name}")
            rest = [(n, d) for n, d in rest if n != name]
            rest.append((name, body))
        credits.append({key: entry[key] for key in ("lump", "author", "license", "source")})
    for kind, (start, end) in NAMESPACES.items():
        rest.append((start, b""))
        rest.extend(original[kind].items())
        rest.append((end, b""))
    return rest, credits


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=ROOT / "public/engine/freedoom2.wad")
    parser.add_argument("--game", type=Path, default=ROOT / "public/engine/tarikh.wad")
    parser.add_argument("--manifest", type=Path, default=ROOT / "assets/manifest.json")
    parser.add_argument("--output", type=Path, help="Defaults to the game WAD (atomic update)")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    lumps, credits = merge_assets(read_wad(args.base), read_wad(args.game), manifest, args.manifest.parent)
    write_wad(args.output or args.game, lumps)
    (ROOT / "public/licenses/REPLACEMENT-ASSETS.json").write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _, sections = split_namespaces(lumps)
    print(f"Assets ready: {len(sections['sprite'])} sprites, {len(sections['flat'])} flats; {len(credits)} manifest replacements")


if __name__ == "__main__":
    main()
