from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VIDEO = ROOT / 'video'
ASSETS = VIDEO / 'assets'
SCREENS = ASSETS / 'screens'
FONTS = ASSETS / 'fonts'
VOICES = ASSETS / 'voice'
WORK = VIDEO / '.work'
URL = 'https://topa-totem.vercel.app'
STORE_URL = URL + '/?loja=lanchonete-bem-te-vi'

for directory in [SCREENS, FONTS, VOICES, WORK]:
    directory.mkdir(parents=True, exist_ok=True)
