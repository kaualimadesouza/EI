"""Validate the exported files, including QR decoding after video compression."""

import json
import subprocess
import sys

from PIL import Image
import zxingcpp

from paths import URL, VIDEO, WORK


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format',
        '-show_streams','-of','json',str(path)],text=True))


def main(format_name='both'):
    results = []
    for name, size in [('horizontal',(1920,1080)),('vertical',(1080,1920))]:
        if format_name!='both' and name!=format_name:
            continue
        path = VIDEO/f'topa-{name}.mp4'
        info = probe(path)
        video = next(s for s in info['streams'] if s['codec_type']=='video')
        audio = next(s for s in info['streams'] if s['codec_type']=='audio')
        assert (video['width'],video['height'])==size, info
        assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p', info
        assert video['avg_frame_rate']=='30/1', info
        assert int(video['nb_frames'])==900, info
        assert abs(float(info['format']['duration'])-30)<.04, info
        assert audio['codec_name']=='aac' and audio['channels']==2, info
        assert audio['sample_rate']=='48000', info
        measure=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),
            '-af','loudnorm=I=-16:TP=-1.5:LRA=8:print_format=json',
            '-f','null','-'],capture_output=True,text=True,check=True)
        loudness=json.loads(measure.stderr[measure.stderr.rfind('{'):])
        assert -17<=float(loudness['input_i'])<=-15, loudness
        assert float(loudness['input_tp'])<=-.5, loudness
        qr_samples=[]
        for time in [24.0,26.0,29.5]:
            frame=WORK/f'check-{name}-{time}.png'
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',
                '-ss',str(time),'-i',str(path),'-frames:v','1',str(frame)],check=True)
            result=zxingcpp.read_barcodes(Image.open(frame))
            found=[barcode.text for barcode in result]
            assert URL in found, (name,time,found)
            qr_samples.append({'time':time,'decoded':URL})
        result={'file':path.name,'size':size,'duration':30,'fps':30,
            'frames':900,'video':'H.264 / yuv420p','audio':'AAC stereo / 48 kHz',
            'bytes':path.stat().st_size,'qr_samples':qr_samples,
            'integrated_lufs':float(loudness['input_i']),
            'true_peak_dbtp':float(loudness['input_tp'])}
        results.append(result)
        print(f'Validado: {name}, 30s, {size[0]}×{size[1]}, 900 frames, QR legível.',flush=True)
    report=VIDEO/'validacao.json'
    if report.exists() and format_name!='both':
        old=json.loads(report.read_text())
        results=[row for row in old if row['file']!=results[0]['file']]+results
    report.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    main(sys.argv[1] if len(sys.argv)>1 else 'both')
