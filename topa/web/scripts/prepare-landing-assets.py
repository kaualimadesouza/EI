"""Prepare small web assets from the versioned TOPA screens and v2 films."""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
DESTINATION = ROOT / 'topa/web/public/landing'
DESTINATION.mkdir(parents=True, exist_ok=True)


def convert(source, output, *options):
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-i', str(ROOT / source), *options, str(DESTINATION / output),
    ], check=True)
    print(output, flush=True)


for source, output, width in [
    ('video/assets/screens/kiosk-menu.png', 'kiosk.webp', 1050),
    ('video/assets/screens/phone-menu.png', 'phone.webp', 780),
]:
    convert(source, output, '-vf', f'scale={width}:-2', '-frames:v', '1', '-quality', '85')

convert('video/assets/screens/dashboard.png', 'dashboard.webp',
    '-vf', 'crop=1995:810:515:580,scale=1500:-2', '-frames:v', '1', '-quality', '90')
convert('video/topa-horizontal-v2.mp4', 'video-poster.webp',
    '-ss', '8', '-vf', 'scale=1400:-2', '-frames:v', '1', '-quality', '85')

for name, scale in [('horizontal', '1280:-2'), ('vertical', '-2:1280')]:
    convert(f'video/topa-{name}-v2.mp4', f'topa-{name}-v2.mp4',
        '-vf', f'scale={scale}', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart')
