"""Exercise the landing in Chromium at desktop, tablet and phone sizes."""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'topa/web/.playwright-mcp/landing'
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('TOPA_PREVIEW_URL', 'http://127.0.0.1:5188').rstrip('/')


async def main():
    results = []
    async with async_playwright() as p:
        executable = os.environ.get('TOPA_VIDEO_CHROMIUM', p.chromium.executable_path)
        browser = await p.chromium.launch(executable_path=executable)
        for width, height in [(1440,1000),(768,1024),(390,844),(320,740)]:
            page = await browser.new_page(viewport={'width':width,'height':height},
                device_scale_factor=1, reduced_motion='reduce', locale='pt-BR')
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            response=await page.goto(BASE+'/conheca',wait_until='networkidle')
            assert response.status==200
            await page.evaluate('document.fonts.ready')
            assert await page.get_by_role('heading',level=1).count()==1
            assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            await page.screenshot(path=str(OUTPUT/f'hero-{width}.png'))

            for label,alt in [
                ('No celular','Cardápio do TOPA no navegador do celular'),
                ('Na sua gestão','Painel do TOPA com pedidos de demonstração'),
                ('No totem','Cardápio do TOPA no totem'),
            ]:
                await page.get_by_role('button',name=label,exact=True).click()
                image=page.get_by_role('img',name=alt,exact=True)
                await image.wait_for()
                await image.evaluate('(image) => image.decode()')

            await page.get_by_role('button',name='Assistir vídeo',exact=True).click()
            dialog=page.get_by_role('dialog')
            await dialog.wait_for()
            await page.wait_for_function('document.querySelector("dialog video").readyState >= 1')
            current=await dialog.locator('video').evaluate('(video) => video.currentSrc')
            expected='vertical' if width<=600 else 'horizontal'
            assert f'topa-{expected}-v2.mp4' in current, current
            await page.screenshot(path=str(OUTPUT/f'video-{width}.png'))
            await page.keyboard.press('Escape')
            assert await page.get_by_role('dialog').count()==0

            if width<=960:
                await page.get_by_role('button',name='Abrir menu').click()
                menu=page.get_by_role('navigation',name='Navegação mobile')
                await menu.get_by_role('link',name='Planos',exact=True).click()
                assert not await menu.is_visible()
            else:
                await page.get_by_role('link',name='Ver planos',exact=True).click()
            await page.screenshot(path=str(OUTPUT/f'plans-{width}.png'))
            await page.locator('summary').filter(has_text='Meu cliente precisa baixar um aplicativo?').click()
            assert await page.get_by_text('Não. O QR Code ou a etiqueta NFC',exact=False).is_visible()

            # Load below-the-fold illustrations before a full-page capture.
            full_height=await page.evaluate('document.documentElement.scrollHeight')
            for top in range(0,full_height,height):
                await page.evaluate('(top) => window.scrollTo(0, top)',top)
                await page.wait_for_timeout(60)
            await page.evaluate('window.scrollTo(0,0)')
            await page.screenshot(path=str(OUTPUT/f'page-{width}.png'),full_page=True)
            assert not errors, errors
            results.append({'width':width,'height':height,'video':expected,'errors':errors,'horizontal_overflow':False})
            print(f'Conferido: {width}×{height}, vídeo {expected}, menu, demonstração e FAQ.',flush=True)
            await page.close()

        page=await browser.new_page()
        await page.goto(BASE+'/?loja=lanchonete-bem-te-vi',wait_until='networkidle')
        await page.get_by_role('heading',name='Peça aqui. Pague aqui.').wait_for()
        await page.goto(BASE+'/painel',wait_until='networkidle')
        await page.get_by_role('heading',name='Painel do lojista').wait_for()
        await browser.close()
    (OUTPUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')


asyncio.run(main())
