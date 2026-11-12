"""Publish corresponding source, never arbitrary working-directory files."""
from pathlib import Path
import zipfile

ROOT_FILES = {'package.json', 'package-lock.json', 'vite.config.js', 'index.html',
              'rpg.html', 'admin.html', '.env.example', '.gitignore'}
SOURCE_DIRS = {'src', 'scripts', 'supabase', 'assets', 'docs', 'tests', 'vendor'}
SOURCE_SUFFIXES = {'.js', '.mjs', '.c', '.h', '.cpp', '.py', '.sql', '.css',
                   '.html', '.json', '.md', '.txt', '.sln', '.vcxproj', '.filters'}
EXCLUDED_DIRS = {'node_modules', 'dist', 'test-results', 'screenshots', '__pycache__'}


def include_source(rel):
    name = rel.name.lower()
    if len(rel.parts) == 1:
        return rel.name in ROOT_FILES or rel.suffix.lower() == '.md'
    if any(part.startswith('.') or part.lower() in EXCLUDED_DIRS for part in rel.parts):
        return False
    if any(word in name for word in ('credential', 'secret', 'token', 'password')):
        return False
    if rel.parts[:2] == ('public', 'licenses'):
        return rel.suffix.lower() in {'.txt', '.md'}
    if rel.parts[0] not in SOURCE_DIRS:
        return False
    return (rel.suffix.lower() in SOURCE_SUFFIXES or
            name.startswith('makefile') or name in {'copying', 'license'})


def bundle(root):
    root = root.resolve()
    destination = root / 'dist' / 'tarikh-source.zip'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob('*')):
            rel = path.relative_to(root)
            if not include_source(rel) or not path.is_file():
                continue
            # Reject symlinks/junctions, including their ancestors.
            if any(p.is_symlink() or
                   (hasattr(p, 'is_junction') and p.is_junction())
                   for p in [path, *path.parents] if p != root and root in p.parents):
                continue
            if not path.resolve().is_relative_to(root):
                continue
            archive.write(path, rel)
    return destination


if __name__ == '__main__':
    bundle(Path(__file__).resolve().parents[1])
    print('Corresponding source: dist/tarikh-source.zip')
