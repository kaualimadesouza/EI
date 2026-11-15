import argparse
from functools import lru_cache
import json
import math
import re
import subprocess
import time

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from paths import ROOT, WORK, ASSETS, FONTS, SCREENS, VIDEO
CSS = (ROOT / 'topa/web/src/index.css').read_text()
C = {key: value for key, value in re.findall(r'--color-([\w-]+):\s*(#[a-fA-F0-9]{6})', CSS)}
CAPTIONS = json.loads((WORK / 'captions.json').read_text())
FPS = 30
CUTS = [0, 5, 13, 23, 30]


def ease(t, start=0, duration=.7):
    x = min(1, max(0, (t-start)/duration))
    return 1-(1-x)**3


@lru_cache(maxsize=180)
def font(size, weight=400):
    result = ImageFont.truetype(str(FONTS / 'Lexend.ttf'), round(size))
    result.set_variation_by_axes([weight])
    return result


@lru_cache(maxsize=700)
def text_layer(text, size, color, weight=400, spacing=1.12):
    face = font(size, weight)
    lines = text.split('\n')
    width = max(round(face.getlength(line)) for line in lines)+8
    height = round(size*spacing*(len(lines)-1)+size*1.35)+8
    result = Image.new('RGBA', (width, height))
    draw = ImageDraw.Draw(result)
    for i, line in enumerate(lines):
        draw.text((2, i*size*spacing), line, font=face, fill=color, anchor='lt',
            stroke_width=0)
    return result


def place(frame, layer, x, y, opacity=1):
    if opacity <= 0:
        return
    if opacity < .999:
        layer = layer.copy()
        layer.putalpha(layer.getchannel('A').point(lambda a: round(a*opacity)))
    frame.paste(layer, (round(x), round(y)), layer)


def text(frame, value, x, y, size, color, weight=400, reveal=1, center=False,
         spacing=1.12):
    layer = text_layer(value, size, color, weight, spacing)
    if center:
        x -= layer.width/2
    place(frame, layer, x, y+30*(1-reveal), reveal)


@lru_cache(maxsize=30)
def logo(width, light=False, full=False):
    raw = Image.open(ROOT / 'assets/topa-logo.png').convert('RGBA')
    if not full:
        raw = raw.crop((0,0,736,278))
    alpha = raw.getchannel('A')
    result = Image.new('RGBA', raw.size, C['white'] if light else C['teal'])
    result.putalpha(alpha)
    return result.resize((width, round(width*raw.height/raw.width)), Image.Resampling.LANCZOS)


@lru_cache(maxsize=70)
def asset(name, width):
    directory = ASSETS if name.endswith('-qr') else SCREENS
    im = Image.open(directory / f'{name}.png').convert('RGBA')
    return im.resize((width, round(width*im.height/im.width)), Image.Resampling.LANCZOS)


@lru_cache(maxsize=60)
def shadow_layer(width, height, radius=35):
    im = Image.new('RGBA',(width+160,height+160))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((65,65,width+95,height+95),radius=radius,fill=(0,0,0,37))
    return im.filter(ImageFilter.GaussianBlur(25))


def rounded_content(im, radius):
    mask = Image.new('L',im.size)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width-1,im.height-1),radius,fill=255)
    result = im.convert('RGBA')
    result.putalpha(mask)
    return result


@lru_cache(maxsize=60)
def tablet(name, width):
    screen_w = width-26
    screen = asset(name, screen_w)
    height = screen.height+38
    im = Image.new('RGBA',(width,height))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,width-1,height-1),39,fill=C['slate'])
    d.rounded_rectangle((3,3,width-4,height-4),36,fill=C['teal'])
    place(im,rounded_content(screen,24),13,18)
    d.ellipse((width/2-2,6,width/2+2,10),fill=C['sage'])
    return im


@lru_cache(maxsize=40)
def phone(name, width):
    screen = asset(name,width-24)
    bar_h = 37
    height = screen.height+bar_h+48
    im=Image.new('RGBA',(width,height))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,width-1,height-1),43,fill=C['slate'])
    d.rounded_rectangle((3,3,width-4,height-4),40,fill=C['teal'])
    d.rounded_rectangle((12,21,width-13,height-21),29,fill=C['cream'])
    d.rounded_rectangle((26,29,width-27,bar_h+15),12,fill=C['ground-2'])
    text(im,'topa-totem.vercel.app',width/2,34,12,C['muted'],center=True)
    place(im, rounded_content(screen,18),12,bar_h+19)
    d.rounded_rectangle((width/2-42,height-13,width/2+42,height-9),2,fill=C['on-teal'])
    return im


@lru_cache(maxsize=40)
def dashboard(name,width):
    raw=Image.open(SCREENS/f'{name}.png').convert('RGBA')
    # Focus on the genuine order board, preserving all three statuses.
    raw=raw.crop((515,580,2510,1390))
    raw=raw.resize((width-28,round((width-28)*raw.height/raw.width)),Image.Resampling.LANCZOS)
    im=Image.new('RGBA',(width,raw.height+90))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,im.width-1,im.height-1),26,fill=C['white'])
    for i in range(3):
        d.ellipse((22+i*18,24,30+i*18,32),fill=C['sage'])
    text(im,'Painel do lojista',88,18,18,C['teal'],500)
    place(im,rounded_content(raw,17),14,58)
    return im


@lru_cache(maxsize=12)
def receipt(number,width,angle):
    h=round(width*1.3)
    im=Image.new('RGBA',(width+90,h+100))
    card=Image.new('RGBA',(width,h))
    d=ImageDraw.Draw(card)
    d.rounded_rectangle((0,0,width-1,h-14),24,fill=C['white'])
    d.rectangle((0,50,width,h-20),fill=C['white'])
    teeth=[]
    for x in range(0,width+20,20):
        teeth += [(x,h-20),(x+10,h-7)]
    d.polygon([(0,h-30),(width,h-30)]+list(reversed(teeth)),fill=C['white'])
    text(card,'Pedido',28,28,24,C['muted'])
    text(card,f'{number:03}',24,78,92,C['teal'],600)
    d.line((28,198,width-28,198),fill=C['line'],width=2)
    for i in range(3):
        d.rounded_rectangle((28,225+i*25,width-28-(i%2)*52,231+i*25),3,fill=C['line'])
    d.rounded_rectangle((28,h-90,width-28,h-43),20,fill=C['warning-tint'])
    text(card,'Em espera',width/2,h-78,22,C['warning'],500,center=True)
    card=card.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    alpha=card.getchannel('A')
    sh=Image.new('RGBA',card.size,(0,0,0,0))
    sh.putalpha(alpha.point(lambda a: round(a*.14)))
    sh=sh.filter(ImageFilter.GaussianBlur(10))
    place(im,sh,(im.width-sh.width)/2+3,(im.height-sh.height)/2+12)
    place(im,card,(im.width-card.width)/2,(im.height-card.height)/2)
    return im


def pill(frame,label,x,y,size=25,dark=False,outline=False):
    layer=text_layer(label,size,C['white'] if dark else C['teal'],500)
    w=layer.width+48;h=round(size*1.2)+30
    d=ImageDraw.Draw(frame)
    d.rounded_rectangle((x,y,x+w,y+h),h/2,
        fill=C['slate'] if dark else C['sage-tint'],
        outline=C['sage'] if outline else None,width=1)
    place(frame,layer,x+23,y+14)


def arrow(draw,x,y,color,size=25):
    draw.line((x-size,y,x+size,y),fill=color,width=4)
    draw.line((x+size-13,y-13,x+size,y,x+size-13,y+13),fill=color,width=4)


def flowing_path(frame,points,t,color,width=3,dot=True):
    d=ImageDraw.Draw(frame)
    d.line(points,fill=color,width=width,joint='curve')
    if dot:
        p=(t*.19)%1
        lengths=[math.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(points,points[1:])]
        target=sum(lengths)*p
        for a,b,dist in zip(points,points[1:],lengths):
            if target<=dist:
                q=target/max(dist,.01);x=a[0]+q*(b[0]-a[0]);y=a[1]+q*(b[1]-a[1])
                d.ellipse((x-7,y-7,x+7,y+7),fill=color)
                break
            target-=dist


class Film:
    def __init__(self,vertical=False):
        self.v=vertical
        self.w,self.h=(1080,1920) if vertical else (1920,1080)
        self.m=84 if vertical else 96

    def background(self,dark=False):
        im=Image.new('RGB',(self.w,self.h),C['teal'] if dark else C['cream'])
        d=ImageDraw.Draw(im)
        if self.v:
            box=(325,605,1335,1615)
        else:
            box=(1010,102,2020,1112)
        if not dark:
            d.ellipse(box,fill=C['sage-tint'])
        else:
            for grow in [0,95,190]:
                shifted=tuple(v+(-grow if i<2 else grow) for i,v in enumerate(box))
                d.arc(shifted,205,355,fill=C['slate'],width=2)
        return im

    def header(self,im,dark=False):
        m=self.m
        if self.v:
            place(im,logo(225,dark),m,137)
            text(im,'Totem por assinatura',m,241,25,C['on-teal'] if dark else C['muted'])
        else:
            place(im,logo(230,dark),m,54)
            d=ImageDraw.Draw(im)
            d.line((363,74,363,118),fill=C['sage'],width=1)
            text(im,'Totem por assinatura',390,85,25,C['on-teal'] if dark else C['muted'])

    def progress(self,im,time,dark=False):
        d=ImageDraw.Draw(im)
        m=self.m
        y=1747 if self.v else 1045
        available=self.w-2*m-(60 if self.v else 0)
        width=(available-3*10)/4
        for i in range(4):
            x=m+i*(width+10)
            d.rounded_rectangle((x,y,x+width,y+3),2,fill=C['slate'] if dark else C['line'])
            ratio=min(1,max(0,(time-CUTS[i])/(CUTS[i+1]-CUTS[i])))
            if ratio:
                d.rounded_rectangle((x,y,x+max(3,width*ratio),y+3),2,
                    fill=C['on-teal'] if dark else C['teal'])

    def caption(self,im,time,dark=False):
        cue=next((c for c in CAPTIONS if c['start']<=time<c['end']),None)
        if not cue:return
        size=34 if self.v else 31
        words=cue['text'].split()
        lines=[];line=''
        for word in words:
            attempt=(line+' '+word).strip()
            if font(size).getlength(attempt)>(820 if self.v else 1510):
                lines.append(line);line=word
            else:line=attempt
        if line:lines.append(line)
        layer=text_layer('\n'.join(lines),size,C['white'],500,1.22)
        cx=(self.w-60)/2 if self.v else self.w/2
        cy=1610 if self.v else 967
        x=round(cx-layer.width/2);y=round(cy-layer.height/2)
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((x-23,y-15,x+layer.width+23,y+layer.height+12),17,fill=C['teal'] if not dark else C['slate'])
        place(im,layer,x,y)

    def demo_label(self,im,dark=False):
        text(im,'Demonstração do produto',self.m,1500 if self.v else 898,
             22 if self.v else 20,C['on-teal'] if dark else C['muted'])

    def scene(self,index,t):
        im=self.background(index==2)
        d=ImageDraw.Draw(im)
        m=self.m;v=self.v
        self.header(im,index==2)
        if index==0:
            r=ease(t,.12,.7)
            if v:
                text(im,'Seu negócio\ncresceu.',m,365,99,C['teal'],600,r,spacing=1.08)
                text(im,'A fila\ntambém?',m,619,116,C['teal'],600,ease(t,.55,.65),spacing=1.05)
                positions=[(145,1010),(370,930),(583,1015)]
                width=243
                flowing_path(im,[(84,1420),(330,1420),(450,1370),(670,1370),(930,1440)],t,C['sage'])
            else:
                text(im,'Seu negócio\ncresceu.',m,235,109,C['teal'],600,r,spacing=1.08)
                text(im,'A fila também?',m,515,112,C['teal'],600,ease(t,.55,.65))
                positions=[(1040,350),(1272,218),(1510,335)]
                width=275
                flowing_path(im,[(m,810),(630,810),(920,735),(1220,735),(1500,805),(1840,805)],t,C['sage'])
            for i,(x,y) in enumerate(positions):
                anim=ease(t,.1+i*.22,.7)
                ticket=receipt(i+1,width,[-7,2,8][i])
                place(im,ticket,x+50*(1-anim),y+100*(1-anim)+math.sin(t*1.5+i)*5,anim)
        elif index==1:
            if v:
                text(im,'Autoatendimento\npor assinatura.',m,365,78,C['teal'],600,ease(t),spacing=1.1)
                pill(im,'No totem da sua loja',m,575,26)
                tw=535;x=245;y=680
            else:
                text(im,'Autoatendimento\npor assinatura.',m,265,99,C['teal'],600,ease(t),spacing=1.1)
                pill(im,'No totem da sua loja',m,536,29)
                text(im,'O cliente escolhe.\nO pedido toma forma.',m,655,35,C['muted'],400,ease(t,.35),spacing=1.4)
                tw=491;x=1215;y=178
            name='kiosk-menu' if t<2.85 else ('kiosk-selected' if t<4.4 else 'kiosk-bag')
            device=tablet(name,tw)
            a=ease(t,.08,.85)
            dy=round(y+90*(1-a)+math.sin(t*1.2)*2)
            place(im,shadow_layer(device.width,device.height),x-80,dy-60,a)
            place(im,device,x,dy,a)
            if 2.22<t<2.85:
                q=ease(t,2.22,.35)
                cx=x+tw*.77;cy=dy+device.height*.73
                radius=12+q*22
                d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline=C['teal'],width=3)
            if not v:
                flowing_path(im,[(m,823),(700,823),(938,760),(1110,760)],t,C['sage'])
                arrow(d,1120,760,C['sage'],18)
            self.demo_label(im)
        elif index==2:
            # One sequential product demonstration per beat.
            board=t>=7.0
            if not board:
                if v:
                    text(im,'Totem ocupado?',m,365,70,C['white'],600,ease(t))
                    text(im,'Peça pelo\ncelular.',m,468,90,C['white'],600,ease(t,.2),spacing=1.06)
                    pw=300;x=420;y=705
                    pill(im,'QR Code ou NFC',m,1280,26,True)
                    text(im,'Sem baixar aplicativo.',m,1382,31,C['on-teal'],500,ease(t,.8))
                else:
                    text(im,'Totem ocupado?',m,240,83,C['white'],600,ease(t))
                    text(im,'Peça pelo\ncelular.',m,355,111,C['white'],600,ease(t,.2),spacing=1.05)
                    pill(im,'QR Code ou NFC',m,650,30,True)
                    text(im,'Sem baixar aplicativo.',m,752,34,C['on-teal'],500,ease(t,.9))
                    pw=324;x=1337;y=180
                dev=phone('phone-menu' if t<4.1 else 'phone-bag',pw)
                a=ease(t,.1,.8)
                place(im,shadow_layer(dev.width,dev.height),x-80,y-55+60*(1-a),a)
                place(im,dev,x,y+60*(1-a),a)
                # An animated path joins the channel symbols to the browser.
                if v:
                    qr=asset('menu-qr',188)
                    d.rounded_rectangle((m,827,m+224,1051),25,fill=C['white'])
                    place(im,qr,m+18,845)
                    text(im,'QR Code',m+112,1075,23,C['on-teal'],center=True)
                    flowing_path(im,[(m+240,940),(394,940)],t,C['sage'],3)
                    arrow(d,395,940,C['sage'],15)
                    for rad in [21,35,49]:
                        d.arc((m+50-rad,1185-rad,m+50+rad,1185+rad),-62,62,
                            fill=C['on-teal'],width=4)
                    text(im,'NFC',m+127,1171,25,C['on-teal'],500)
                else:
                    flowing_path(im,[(905,535),(1080,535),(1130,482),(1270,482)],t,C['sage'],4)
                    arrow(d,1282,482,C['sage'],18)
                    qr=asset('menu-qr',136)
                    d.rounded_rectangle((930,290,1102,462),23,fill=C['white'])
                    place(im,qr,948,308)
                    text(im,'QR Code',1016,477,21,C['on-teal'],center=True)
                    for rad in [23,39,55]:
                        d.arc((969-rad,660-rad,969+rad,660+rad),-62,62,fill=C['on-teal'],width=4)
                    text(im,'NFC',1050,641,23,C['on-teal'],500)
            else:
                b=t-7.0
                if v:
                    text(im,'Pedidos no\npainel da loja.',m,365,82,C['white'],600,ease(b),spacing=1.1)
                    text(im,'Do pedido ao preparo.',m,602,32,C['on-teal'],400,ease(b,.15))
                    width=853;x=84;y=850
                else:
                    text(im,'Pedidos no\npainel da loja.',m,280,88,C['white'],600,ease(b),spacing=1.1)
                    text(im,'Do pedido ao preparo.',m,553,32,C['on-teal'],400,ease(b,.15))
                    width=982;x=842;y=322
                shot=dashboard('dashboard' if b<1.8 else 'dashboard-preparing',width)
                a=ease(b,.06,.6)
                place(im,shadow_layer(shot.width,shot.height,26),x-80,y-55+50*(1-a),a)
                place(im,shot,x,y+50*(1-a),a)
                if v:
                    pill(im,'Recebido · Em preparo · Pronto',84,1340,23,True)
                else:
                    flowing_path(im,[(m,755),(570,755),(705,677),(785,677)],t,C['sage'])
                    arrow(d,795,677,C['sage'],18)
            self.demo_label(im,True)
        else:
            # The QR and CTA settle by 24 seconds and remain fixed until 30.
            a=ease(t,0,.65)
            if v:
                text(im,'Topa transformar\nseu atendimento?',m,365,77,C['teal'],600,a,spacing=1.12)
                place(im,logo(451,False,True),277,637,a)
                text(im,'Conheça a experiência do cliente.',m,924,28,C['muted'],400,a)
                box=(m,1000,930,1105)
                d.rounded_rectangle(box,27,fill=C['teal'])
                text(im,'Explore o cardápio',m+39,1032,37,C['white'],500,a)
                arrow(d,872,1052,C['white'],19)
                qr=asset('cta-qr',265)
                place(im,qr,374,1150,a)
                text(im,'topa-totem.vercel.app',m,1448,34,C['teal'],500,a)
            else:
                text(im,'Topa transformar\nseu atendimento?',m,275,97,C['teal'],600,a,spacing=1.1)
                text(im,'Conheça a experiência do cliente.',m,536,31,C['muted'],400,a)
                box=(m,620,747,720)
                d.rounded_rectangle(box,25,fill=C['teal'])
                text(im,'Explore o cardápio',m+34,649,36,C['white'],500,a)
                arrow(d,691,671,C['white'],20)
                text(im,'topa-totem.vercel.app',m,776,34,C['teal'],500,a)
                place(im,logo(445,False,True),1267,204,a)
                qr=asset('cta-qr',315)
                place(im,qr,1335,506,a)
                text(im,'Aponte a câmera',1492,844,23,C['muted'],center=True,reveal=a)
        return im

    def frame(self,t,captions=True):
        index=next((i for i in range(4) if CUTS[i]<=t<CUTS[i+1]),3)
        local=t-CUTS[index]
        im=self.scene(index,local)
        if index<3:
            duration=.3
            next_start=CUTS[index+1]
            if t>next_start-duration:
                p=ease(t,next_start-duration,duration)
                upcoming=self.scene(index+1,.45*p)
                im=Image.blend(im,upcoming,p)
        self.progress(im,t,index==2)
        if captions:self.caption(im,t,index==2)
        return im

    def preview(self):
        times=[2.5,6.7,8.8,10.7,16.5,20.7,26.5]
        thumbs=[]
        for t in times:
            im=self.frame(t)
            im.save(WORK/f'preview-{"vertical" if self.v else "horizontal"}-{t}.png')
            im.thumbnail((480,700) if self.v else (640,360))
            thumbs.append(im)
        w=max(im.width for im in thumbs);h=max(im.height for im in thumbs)
        cols=4 if self.v else 2
        rows=math.ceil(len(thumbs)/cols)
        sheet=Image.new('RGB',(cols*w,rows*(h+35)),C['ground-2'])
        d=ImageDraw.Draw(sheet)
        for i,(t,im) in enumerate(zip(times,thumbs)):
            x=(i%cols)*w;y=(i//cols)*(h+35)
            sheet.paste(im,(x,y))
            d.text((x+12,y+h+8),f'{t:.1f} s',font=font(18),fill=C['teal'])
        path=VIDEO/f'storyboard-{"vertical" if self.v else "horizontal"}.jpg'
        sheet.save(path,quality=92)
        print(path,flush=True)

    def render(self):
        name='vertical' if self.v else 'horizontal'
        path=VIDEO/f'topa-{name}.mp4'
        logfile=open(WORK/f'encode-{name}.log','w')
        command=['ffmpeg','-y','-hide_banner','-loglevel','warning',
            '-f','rawvideo','-pix_fmt','rgb24','-s',f'{self.w}x{self.h}',
            '-r',str(FPS),'-i','-', '-i',str(WORK/'mix.wav'),
            '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium',
            '-crf','18','-pix_fmt','yuv420p','-profile:v','high','-level','4.1',
            '-vf','scale=out_color_matrix=bt709,format=yuv420p',
            '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
            '-threads','4','-c:a','aac','-b:a','192k','-ar','48000',
            '-af','loudnorm=I=-16:TP=-1.5:LRA=8','-t','30',
            '-movflags','+faststart','-metadata','title=TOPA: da fila ao fluxo',
            '-metadata','comment=30 segundos; demonstração do produto; pt-BR',str(path)]
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=logfile)
        start=time.monotonic()
        for frame in range(30*FPS):
            process.stdin.write(self.frame(frame/FPS).tobytes())
            if frame%150==0:
                print(f'{name}: {frame/FPS:.0f}/30s, {time.monotonic()-start:.1f}s de render',flush=True)
        process.stdin.close()
        if process.wait()!=0:
            raise RuntimeError((WORK/f'encode-{name}.log').read_text())
        logfile.close()
        print(f'Pronto: {path}, {path.stat().st_size/1e6:.1f} MB',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--format',choices=['horizontal','vertical','both'],default='both')
    parser.add_argument('--preview',action='store_true')
    args=parser.parse_args()
    for vertical in [False,True]:
        if args.format!='both' and (args.format=='vertical')!=vertical:
            continue
        film=Film(vertical)
        if args.preview:film.preview()
        else:film.render()
