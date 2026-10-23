"""Generate an offline single HTML and a portable ZIP using the Python standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + (root / 'style.css').read_text(encoding='utf-8') + '\n</style>')
for filename in ('game.js', 'ui.js'):
    script = (root / filename).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(f'<script src="{filename}"></script>', '<script>\n' + script + '\n</script>')
(root / '能源前线-离线版.html').write_text(html, encoding='utf-8')
files = ['index.html', 'style.css', 'game.js', 'ui.js', 'README.md', 'build.py', '能源前线-离线版.html', 'tests/simulation.test.js', 'tests/browser-smoke.js']
with ZipFile(root / '能源前线-游戏包.zip', 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, '能源前线/' + name)
print('Generated 能源前线-离线版.html and 能源前线-游戏包.zip')
