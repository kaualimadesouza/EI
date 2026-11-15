import asyncio
import html
import json
import subprocess
import wave

import edge_tts
import numpy as np

from paths import VOICES, VIDEO, WORK

ASSETS = WORK
SR = 48000
SEGMENTS = [
    (0.55, 4.35, 'Seu negócio cresceu. A fila também?'),
    (5.35, 12.65, 'Com TOPA, seu balcão ganha autoatendimento por assinatura. O cliente escolhe e monta o próprio pedido.'),
    (13.4, 22.7, 'Totem ocupado? Seu cliente pede pelo celular, por QR Code ou NFC, sem baixar aplicativo. Você acompanha no painel.'),
    (23.5, 29.7, 'TOPA. Totem por assinatura. Topa transformar seu atendimento? Acesse e explore o cardápio.'),
]
PHRASES = [
    ['Seu negócio cresceu.', 'A fila também?'],
    ['Com TOPA, seu balcão ganha', 'autoatendimento por assinatura.',
     'O cliente escolhe e monta', 'o próprio pedido.'],
    ['Totem ocupado?', 'Seu cliente pede pelo celular,', 'por QR Code ou NFC,',
     'sem baixar aplicativo.', 'Você acompanha no painel.'],
    ['TOPA. Totem por assinatura.', 'Topa transformar seu atendimento?',
     'Acesse e explore o cardápio.'],
]


def write_wav(path, data):
    data = np.asarray(data)
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1 if data.ndim == 1 else data.shape[1])
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes((np.clip(data, -.999, .999) * 32767).astype('<i2').tobytes())


def read_wav(path):
    with wave.open(str(path), 'rb') as file:
        return np.frombuffer(file.readframes(file.getnframes()), dtype='<i2').astype(np.float64) / 32768


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration', '-of', 'default=nw=1:nk=1', str(path)], text=True))


async def voice():
    narration = np.zeros(30 * SR)
    captions = []
    for index, (start, end, text) in enumerate(SEGMENTS):
        raw = VOICES / f'voice-{index}.mp3'
        timings_path = VOICES / f'voice-{index}.json'
        if raw.exists() and timings_path.exists() and raw.stat().st_size > 1000:
            words = json.loads(timings_path.read_text())
        else:
            words = []
            communicate = edge_tts.Communicate(text, 'pt-BR-FranciscaNeural',
                rate='+0%', pitch='-2Hz', boundary='WordBoundary',
                connect_timeout=15, receive_timeout=40)
            with raw.open('wb') as file:
                async for part in communicate.stream():
                    if part['type'] == 'audio':
                        file.write(part['data'])
                    elif part['type'] == 'WordBoundary':
                        words.append({key: part[key] for key in ['offset', 'duration', 'text']})
            timings_path.write_text(json.dumps(words, ensure_ascii=False))
        raw_duration = duration(raw)
        speed = max(.96, raw_duration / (end - start))
        target = ASSETS / f'voice-{index}.wav'
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', str(raw), '-af', f'atempo={speed:.6f},aresample={SR}',
            '-ac', '1', '-c:a', 'pcm_s16le', str(target)], check=True)
        sound = read_wav(target)
        offset = round(start * SR)
        narration[offset:offset+len(sound)] += sound[:len(narration)-offset]
        phrase_groups = []
        cursor = 0
        for phrase in PHRASES[index]:
            count = len(phrase.split())
            phrase_groups.append((phrase, words[cursor:cursor+count]))
            cursor += count
        if cursor != len(words):
            raise ValueError(f'Texto e marcações de voz divergiram no card {index+1}.')
        for i, (phrase, group) in enumerate(phrase_groups):
            a = start + group[0]['offset'] / 1e7 / speed
            b = start + (group[-1]['offset'] + group[-1]['duration']) / 1e7 / speed + .16
            if i + 1 < len(phrase_groups):
                b = min(b, start + phrase_groups[i+1][1][0]['offset'] / 1e7 / speed - .02)
            captions.append({'start': a, 'end': min(b, end),
                'text': html.unescape(phrase)})
        print(f'Narração {index+1}/4: {raw_duration:.2f}s, ajuste {speed:.3f}x', flush=True)
    peak = np.max(np.abs(narration))
    narration *= .78 / max(peak, .001)
    write_wav(ASSETS / 'narration.wav', narration)
    (ASSETS / 'captions.json').write_text(json.dumps(captions, ensure_ascii=False, indent=2))
    def stamp(seconds):
        ms = round(seconds * 1000)
        return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    (VIDEO / 'legendas.srt').write_text('\n\n'.join(
        f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}'
        for i, c in enumerate(captions)) + '\n')
    return narration


def music(narration):
    rng = np.random.default_rng(94)
    track = np.zeros((30 * SR, 2))
    beat = 60 / 104
    chords = [[48,55,59,62,64], [45,52,55,59,60], [41,48,52,55,57], [43,50,53,57,59]]
    def add(sound, start, gain=1, pan=0):
        offset = round(start * SR)
        if offset < 0 or offset >= len(track):
            return
        length = min(len(sound), len(track)-offset)
        track[offset:offset+length, 0] += sound[:length] * gain * np.sqrt((1-pan)/2)
        track[offset:offset+length, 1] += sound[:length] * gain * np.sqrt((1+pan)/2)
    def note(midi, length, soft=True):
        t = np.arange(round(length*SR))/SR
        f = 440 * 2**((midi-69)/12)
        envelope = np.minimum(1, t/.014) * np.exp(-t/(.85 if soft else .18))
        return envelope * (np.sin(2*np.pi*f*t) + .18*np.sin(2*np.pi*f*2*t) + .05*np.sin(2*np.pi*f*3*t))
    for n in range(8):
        start = n * beat * 8
        chord = chords[n % 4]
        for midi in chord:
            add(note(midi+12, 4.0), start, .017, (midi%3-1)*.35)
        for k in range(16):
            add(note(chord[[0,2,3,4,2,3,1,2][k%8]]+24, .5, False),
                start+k*beat/2, .018, .45 if k%2 else -.45)
        for k in [0,2,4,6]:
            add(note(chord[0]-12, .6), start+k*beat, .05)
    for k in range(52):
        start = k * beat
        t = np.arange(int(.22*SR))/SR
        if k % 2 == 0:
            kick = np.sin(2*np.pi*(46*t+80*.015*(1-np.exp(-t/.015))))*np.exp(-t*26)
            add(kick, start, .11)
        else:
            noise = rng.normal(0,1,len(t))
            snare = (noise-np.roll(noise,1))*.18*np.exp(-t*38) + .2*np.sin(2*np.pi*175*t)*np.exp(-t*32)
            add(snare, start, .045, .1)
        for half in [0,.5]:
            t = np.arange(int(.06*SR))/SR
            noise = rng.normal(0,1,len(t))
            add((noise-np.roll(noise,1))*np.exp(-t*80), start+half*beat, .008, -.25)
    # Original short transitions and tactile tap accents.
    for start in [4.72, 12.72, 22.72]:
        t = np.arange(int(.4*SR))/SR
        noise = rng.normal(0,1,len(t))
        add((noise+np.roll(noise,1)) * np.sin(np.pi*t/.4)**2, start, .014)
    for start in [7.9, 9.35, 14.6, 18.65, 24.2]:
        add(note(88, .18, False), start, .026)
    times = np.arange(len(track))/SR
    fade = np.minimum(1, times/.6) * np.minimum(1, np.maximum(0,30-times)/1.2)
    track *= fade[:,None]
    # Smooth speech envelope ducks the score without pumping between syllables.
    envelope = np.convolve(np.abs(narration[::480]), np.ones(45)/45, mode='same')
    duck = np.interp(np.arange(len(track)), np.arange(len(envelope))*480,
        np.clip(1-envelope*7, .28, 1))
    track *= duck[:,None]
    write_wav(ASSETS / 'music.wav', track)
    mix = track + narration[:,None]
    write_wav(ASSETS / 'mix.wav', mix)
    print('Trilha original, efeitos e mixagem prontos.', flush=True)


async def main():
    narration = await voice()
    music(narration)


if __name__ == '__main__':
    asyncio.run(main())
