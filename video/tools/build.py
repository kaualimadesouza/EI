"""Rebuild the film from versioned inputs; optionally renew browser captures or voice."""

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import urllib.request

from paths import ASSETS, FONTS, ROOT, SCREENS, URL, STORE_URL, VIDEO, VOICES, WORK


def prepare_assets():
    required = ['ffmpeg', 'ffprobe']
    missing = [name for name in required if not shutil.which(name)]
    if missing:
        raise RuntimeError('Instale as ferramentas de sistema: ' + ', '.join(missing))
    urls = {
        'Lexend.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/Lexend%5Bwght%5D.ttf',
        'OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/OFL.txt',
    }
    for name, url in urls.items():
        path = FONTS / name
        if not path.exists():
            with urllib.request.urlopen(url, timeout=30) as response:
                path.write_bytes(response.read())
    if not all((ASSETS / f'{kind}-qr.png').exists() for kind in ['cta', 'menu']):
        node = shutil.which('node')
        if not node:
            raise RuntimeError('Node e as dependências de topa/web são necessários para recriar os QR Codes.')
        source = """
const fs = require('fs');
const QRCode = require('./node_modules/qrcode');
const css = fs.readFileSync('src/index.css', 'utf8');
const teal = css.match(/--color-teal:\\s*(#[a-f0-9]+)/i)[1];
const white = css.match(/--color-white:\\s*(#[a-f0-9]+)/i)[1];
const jobs = JSON.parse(process.argv[1]);
Promise.all(jobs.map(([file,url]) => QRCode.toFile(file,url, {
    width:740, margin:4, errorCorrectionLevel:'H',color:{dark:teal,light:white}
}))).catch(error => { console.error(error); process.exit(1); });
"""
        jobs = [[str(ASSETS/'cta-qr.png'), URL], [str(ASSETS/'menu-qr.png'), STORE_URL]]
        subprocess.run([node, '-e', source, json.dumps(jobs)], cwd=ROOT/'topa/web', check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-captures', action='store_true', help='Capture o app local novamente.')
    parser.add_argument('--refresh-voice', action='store_true', help='Gere novamente a voz pelo serviço remoto.')
    parser.add_argument('--preview-only', action='store_true', help='Gere somente os storyboards.')
    parser.add_argument('--prepare-only', action='store_true', help='Prepare os insumos, sem renderizar.')
    parser.add_argument('--format', choices=['horizontal','vertical','both'], default='both')
    args = parser.parse_args()
    prepare_assets()
    if args.prepare_only:
        return
    required = ['kiosk-menu','kiosk-selected','kiosk-bag','phone-menu','phone-bag','dashboard','dashboard-preparing']
    if args.refresh_captures or not all((SCREENS/f'{name}.png').exists() for name in required):
        import capture
        capture.main()
    if args.refresh_voice:
        for index in range(4):
            # Remove only these generated inputs when the user explicitly renews voice.
            for suffix in ['mp3','json']:
                (VOICES/f'voice-{index}.{suffix}').unlink(missing_ok=True)
    import audio
    asyncio.run(audio.main())
    import render
    for vertical in [False,True]:
        if args.format!='both' and (args.format=='vertical')!=vertical:
            continue
        film = render.Film(vertical)
        film.preview()
        if not args.preview_only:
            film.render()
    if not args.preview_only:
        import validate
        validate.main(args.format)


if __name__ == '__main__':
    main()
