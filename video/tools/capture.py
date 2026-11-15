import asyncio
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

from playwright.async_api import async_playwright

from paths import ROOT, WORK, SCREENS, FONTS

ASSETS = SCREENS
PORT = os.environ.get('TOPA_VIDEO_PORT', '5188')
BASE = f'http://127.0.0.1:{PORT}'


async def use_saved_font(context):
    encoded = base64.b64encode((FONTS / 'Lexend.ttf').read_bytes()).decode()
    css = "@font-face{font-family:'Lexend';font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64," + encoded + ")}"
    await context.route('https://fonts.googleapis.com/**',
        lambda route: route.fulfill(status=200, content_type='text/css', body=css))


async def capture():
    async with async_playwright() as p:
        executable = os.environ.get('TOPA_VIDEO_CHROMIUM', p.chromium.executable_path)
        browser = await p.chromium.launch(executable_path=executable,
            args=['--disable-dev-shm-usage'])
        context = await browser.new_context(viewport={'width': 720, 'height': 960},
            device_scale_factor=2, locale='pt-BR', reduced_motion='reduce')
        await context.add_init_script("localStorage.setItem('topa.totem', 'true')")
        await use_saved_font(context)
        page = await context.new_page()
        await page.goto(BASE, wait_until='networkidle')
        await page.get_by_role('button', name='Comer aqui', exact=True).wait_for()
        await page.evaluate('document.fonts.ready')

        async def shot(page, name):
            await page.wait_for_timeout(350)
            await page.screenshot(path=str(ASSETS / f'{name}.png'))
            print(f'Captura: {name}', flush=True)

        await shot(page, 'kiosk-start')
        await page.get_by_role('button', name='A fila está grande? Peça pelo celular').click()
        await shot(page, 'kiosk-queue')
        await page.get_by_role('button', name='Pedir no totem', exact=True).click()
        await page.get_by_role('button', name='Comer aqui', exact=True).click()
        await page.get_by_role('button', name='Lanches', exact=True).click()
        await shot(page, 'kiosk-menu')
        await page.get_by_role('button', name='Adicionar X-salada', exact=True).click()
        await shot(page, 'kiosk-selected')
        await page.get_by_role('button', name='Adicionar por', exact=False).click()
        await shot(page, 'kiosk-added')
        await page.get_by_role('button', name='Ver pedido', exact=True).click()
        await shot(page, 'kiosk-bag')

        mobile_context = await browser.new_context(viewport={'width': 390, 'height': 780},
            device_scale_factor=3, locale='pt-BR', reduced_motion='reduce')
        await use_saved_font(mobile_context)
        mobile = await mobile_context.new_page()
        await mobile.goto(BASE + '/?loja=lanchonete-bem-te-vi', wait_until='networkidle')
        await mobile.get_by_role('button', name='Comer aqui', exact=True).click()
        await mobile.get_by_role('button', name='Lanches', exact=True).click()
        await shot(mobile, 'phone-menu')
        await mobile.get_by_role('button', name='Adicionar X-salada', exact=True).click()
        await mobile.get_by_role('button', name='Não, obrigado', exact=True).click()
        await mobile.get_by_role('button', name='Ver pedido', exact=True).click()
        await shot(mobile, 'phone-bag')

        dashboard = await context.new_page()
        await dashboard.set_viewport_size({'width': 1280, 'height': 820})
        await dashboard.goto(BASE + '/painel', wait_until='networkidle')
        await dashboard.evaluate('''() => {
            const now = new Date();
            const businessDate = now.toLocaleDateString('sv-SE');
            const statuses = ['received', 'preparing', 'ready'];
            const items = [
              {productId: 'xsalada', name: 'X-salada', quantity: 1, unitPriceCents: 2290},
              {productId: 'misto', name: 'Misto quente', quantity: 1, unitPriceCents: 1490},
              {productId: 'combo-cafe', name: 'Café + pão de queijo', quantity: 1, unitPriceCents: 1290}
            ];
            localStorage.setItem('topa.orders.v3', JSON.stringify(statuses.map((status, index) => ({
              id: 'video-demo-' + index, storeSlug: 'lanchonete-bem-te-vi', businessDate,
              number: index + 1, status, dineIn: true, paymentMethod: 'pix',
              totalCents: items[index].unitPriceCents,
              createdAt: new Date(now.getTime() - (index + 1) * 45000).toISOString(),
              items: [items[index]]
            }))));
            localStorage.setItem('topa_demo_merchant_session', JSON.stringify({
              token: 'demo-token-lanchonete-bem-te-vi',
              merchant: { email: 'admin@bemtevi.topa.com', storeSlug: 'lanchonete-bem-te-vi' }
            }));
        }''')
        await dashboard.reload(wait_until='networkidle')
        await dashboard.get_by_text('Pedidos em andamento', exact=True).wait_for()
        await shot(dashboard, 'dashboard')
        await dashboard.get_by_role('button', name='Começar preparo', exact=True).click()
        await shot(dashboard, 'dashboard-preparing')

        await browser.close()
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        (SCREENS / 'manifest.json').write_text(json.dumps({
            'captured_at': datetime.now(timezone.utc).isoformat(),
            'source_commit': commit,
            'mode': 'demo',
            'data': 'Dados fictícios locais, sem pedidos na API publicada.',
            'viewports': {'kiosk': [720,960,2], 'phone': [390,780,3], 'dashboard': [1280,820,2]},
        }, ensure_ascii=False, indent=2) + '\n')


def main():
    env = os.environ.copy()
    env['VITE_API_URL'] = ''
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Instale Node 20.19+ ou 22.12+ para executar o app.')
    logfile = open(WORK / 'vite.log', 'w')
    server = subprocess.Popen([
        node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', PORT, '--strictPort',
    ], cwd=ROOT / 'topa/web', env=env, stdout=logfile, stderr=logfile)
    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError((WORK / 'vite.log').read_text())
            try:
                urllib.request.urlopen(BASE, timeout=1).close()
                break
            except Exception:
                time.sleep(0.1)
        asyncio.run(capture())
        font = FONTS / 'Lexend.ttf'
        if not font.exists():
            url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/Lexend%5Bwght%5D.ttf'
            with urllib.request.urlopen(url, timeout=30) as response:
                font.write_bytes(response.read())
        print('Capturas e tipografia prontas.', flush=True)
    finally:
        server.terminate()
        server.wait(timeout=10)
        logfile.close()


if __name__ == '__main__':
    main()
