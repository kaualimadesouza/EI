"""Reproduce a merchant's first shift against the disposable local validation API.

Requires scripts.validation_api on 8022 and the API-backed Vite server on 5192.
Never runs against a public host and never transfers money.
"""

import asyncio
import json
import os
from pathlib import Path
import re
from urllib.parse import urlparse
import uuid

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'topa/web/.playwright-mcp/merchant-day'
BASE = os.environ.get('TOPA_VALIDATION_URL', 'http://127.0.0.1:5192').rstrip('/')
API = os.environ.get('TOPA_VALIDATION_API', 'http://127.0.0.1:8022').rstrip('/')
for url in [BASE, API]:
    if urlparse(url).hostname not in {'127.0.0.1', 'localhost'}:
        raise RuntimeError('Use somente o ambiente local descartável, nunca produção.')


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    passed = []

    def checked(scenario):
        passed.append(scenario)
        print('Conferido: ' + scenario, flush=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get(
            'TOPA_VIDEO_CHROMIUM', p.chromium.executable_path))
        owner_context = await browser.new_context(viewport={'width':390, 'height':844}, locale='pt-BR')
        customer_context = await browser.new_context(viewport={'width':390, 'height':844}, locale='pt-BR')
        owner = await owner_context.new_page()
        customer = await customer_context.new_page()
        owner.set_default_timeout(12_000)
        customer.set_default_timeout(12_000)
        errors = []
        owner.on('pageerror', lambda error: errors.append(str(error)))
        customer.on('pageerror', lambda error: errors.append(str(error)))
        await owner.goto(BASE+'/', wait_until='networkidle')
        await owner.get_by_role('button', name='Abrir menu').click()
        nav = owner.get_by_role('navigation', name='Navegação mobile')
        await expect(nav.get_by_role('link', name='Acessar painel', exact=True)).to_be_visible()
        await nav.get_by_role('link', name='Criar minha loja', exact=True).click()
        checked('Gestão e cadastro acessíveis pela landing no celular')

        email = 'expediente-' + uuid.uuid4().hex[:10] + '@example.com'
        password = 'senha-descartavel-123'
        await owner.get_by_label('Nome da loja', exact=True).fill('Restaurante do Ensaio')
        await owner.get_by_label('E-mail', exact=True).fill(email)
        await owner.get_by_label('Senha', exact=True).fill(password)
        await owner.get_by_label('Confirme a senha', exact=True).fill('senha-diferente')
        await owner.get_by_role('button', name='Criar loja e acessar painel').click()
        await expect(owner.get_by_role('alert')).to_contain_text('As senhas não coincidem.')
        await owner.get_by_label('Confirme a senha', exact=True).fill(password)
        async with owner.expect_response(lambda response: response.url.endswith('/auth/register')) as registration:
            await owner.get_by_role('button', name='Criar loja e acessar painel').click()
        assert (await registration.value).status == 201
        account = await (await registration.value).json()
        slug = account['store_slug']
        auth = {'Authorization': 'Bearer ' + account['access_token']}
        await expect(owner.get_by_role('heading', name='Restaurante do Ensaio', exact=True)).to_be_visible()
        await expect(owner.get_by_role('button', name='Abrir loja')).to_be_disabled()
        await owner.reload(wait_until='networkidle')
        await expect(owner.get_by_role('heading', name='Restaurante do Ensaio', exact=True)).to_be_visible()
        checked('Cadastro de lojista, confirmação de senha e sessão após recarga')

        async def add_product(name, price):
            await owner.get_by_role('button', name='Novo produto', exact=True).click()
            dialog = owner.get_by_role('dialog', name='Novo produto')
            await dialog.get_by_label('Nome', exact=True).fill(name)
            await dialog.get_by_label('Categoria', exact=True).fill('Pratos do dia')
            await dialog.get_by_label('Preço (R$)', exact=True).fill(price)
            await dialog.get_by_role('button', name='Salvar', exact=True).click()
            return dialog

        dialog = await add_product('Travessa da casa', '1.234,56')
        await expect(dialog).not_to_be_visible()
        await expect(owner.get_by_role('row', name=re.compile('Travessa da casa'))).to_contain_text('1.234,56')
        dialog = await add_product('Prato feito', '32,90abc')
        await expect(dialog.get_by_role('alert')).to_contain_text('Informe um preço válido.')
        await dialog.get_by_label('Preço (R$)', exact=True).fill('32,90')
        await dialog.get_by_role('button', name='Salvar', exact=True).click()
        await expect(dialog).not_to_be_visible()
        checked('Categoria própria, milhares brasileiros e recusa de preço truncado')

        for width in [320,390,768,1440]:
            await owner.set_viewport_size({'width':width, 'height':900})
            assert await owner.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            if width < 640:
                assert await owner.locator('table').last.evaluate('(table) => table.parentElement.scrollWidth <= table.parentElement.clientWidth'), width
            switch = owner.get_by_role('switch', name='Prato feito à venda', exact=True)
            await switch.scroll_into_view_if_needed()
            box = await switch.bounding_box()
            assert box and 0 <= box['x'] and box['x']+box['width'] <= width, (width,box)
            await owner.screenshot(path=str(OUTPUT/f'gestao-{width}.png'), full_page=True)
        await owner.set_viewport_size({'width':390, 'height':844})
        checked('Gestão sem rolagem horizontal em 320, 390, 768 e 1440 px')

        await owner.get_by_role('button', name='Abrir loja', exact=True).click()
        await expect(owner.get_by_text('Loja aberta para pedidos', exact=True)).to_be_visible()
        await owner.get_by_role('navigation', name='Atalhos do painel').get_by_role('link', name='Pedidos', exact=True).click()
        heading_box = await owner.get_by_role('heading', name='Pedidos em andamento', exact=True).bounding_box()
        assert heading_box and 0 <= heading_box['y'] < 844
        await expect(owner.get_by_role('link', name='Ver cardápio', exact=True)).to_have_attribute('href', '/pedir?loja='+slug)
        await expect(owner.get_by_role('link', name='Abrir o totem', exact=True).last).to_have_attribute('href', '/totem?loja='+slug)
        await customer.goto(BASE+'/pedir?loja='+slug, wait_until='networkidle')
        await customer.get_by_role('button', name=re.compile('Comer aqui')).click()
        await customer.get_by_role('button', name='Adicionar Prato feito', exact=True).click()
        await customer.get_by_role('button', name='Ver pedido', exact=True).click()
        async with customer.expect_response(lambda response: response.url.endswith('/payments/pix') and response.status == 201) as charge_response:
            await customer.get_by_role('button', name='Pagar', exact=True).click()
        charge = await (await charge_response.value).json()
        assert charge['amount_cents'] == 3290
        await expect(customer.get_by_role('button', name='Copiar código Pix')).to_be_visible()
        orders = await owner.request.get(BASE+'/api/orders?loja='+slug, headers=auth)
        assert await orders.json() == []
        await expect(owner.get_by_text('R$ 0,00', exact=True).first).to_be_visible()
        checked('Pedido Pix pendente não aparece na cozinha nem no faturamento')

        confirmed = await owner.request.post(API+'/__validation/payments/'+charge['id']+'/confirm')
        assert confirmed.status == 200
        await expect(customer.get_by_role('status')).to_contain_text('Preparando seu pedido', timeout=15_000)
        article = owner.get_by_role('article', name=re.compile('Pedido [0-9]+'))
        await expect(article).to_be_visible(timeout=15_000)
        for action, region in [('Começar preparo','Em preparo'), ('Marcar como pronto','Prontos')]:
            await article.get_by_role('button', name=action, exact=True).click()
            article = owner.get_by_role('region', name=region, exact=True).get_by_role('article')
            await expect(article).to_be_visible()
        await expect(customer.get_by_role('status')).to_contain_text('Seu pedido está pronto', timeout=15_000)
        await article.get_by_role('button', name='Entregar', exact=True).click()
        await expect(owner.get_by_text('Entregues hoje (1)', exact=True)).to_be_visible()
        orders = await (await owner.request.get(BASE+'/api/orders?loja='+slug, headers=auth)).json()
        assert len(orders) == 1 and orders[0]['status'] == 'delivered'
        await expect(owner.get_by_text('R$ 32,90', exact=True).first).to_be_visible()
        checked('Provedor fictício confirma; cozinha prepara, avisa e entrega sem duplicar')

        await owner.get_by_role('switch', name='Prato feito à venda', exact=True).click()
        await customer.goto(BASE+'/pedir?loja='+slug, wait_until='networkidle')
        await customer.get_by_role('button', name=re.compile('Comer aqui')).click()
        await expect(customer.get_by_role('button', name='Prato feito, esgotado', exact=True)).to_be_disabled()
        await owner.get_by_role('switch', name='Prato feito à venda', exact=True).click()
        checked('Esgotar e repor produto se refletem no próximo cliente')

        await owner_context.route('**/api/stores/*/ordering', lambda route: route.abort())
        await owner.get_by_role('button', name='Pausar pedidos', exact=True).click()
        await expect(owner.get_by_role('alert').filter(has_text='Não foi possível alterar o recebimento')).to_be_visible()
        await expect(owner.get_by_text('Loja aberta para pedidos', exact=True)).to_be_visible()
        await owner_context.unroute('**/api/stores/*/ordering')
        await owner.get_by_role('button', name='Pausar pedidos', exact=True).click()
        await expect(owner.get_by_text('Pedidos pausados', exact=True)).to_be_visible()
        await customer.goto(BASE+'/pedir?loja='+slug, wait_until='networkidle')
        await expect(customer.get_by_role('heading', name='Loja fechada para pedidos')).to_be_visible()
        menu = await (await owner.request.get(BASE+'/api/menu?loja='+slug)).json()
        refused = await customer.request.post(BASE+'/api/orders', data={
            'store_slug':slug, 'items':[{'product_id':menu['products'][0]['id'],'quantity':1}],
            'dine_in':True, 'payment_method':'pix'})
        assert refused.status == 409
        checked('Falha de conexão preserva estado; encerramento bloqueia novos pedidos na API')

        forbidden = await owner.request.get(BASE+'/api/orders?loja=lanchonete-bem-te-vi', headers=auth)
        assert forbidden.status == 403
        duplicate = await owner.request.post(BASE+'/api/auth/register', data={
            'store_name':'Outra loja', 'email':email.upper(), 'password':password})
        assert duplicate.status == 409
        await owner.get_by_role('button', name='Sair', exact=True).last.click()
        await owner.get_by_label('E-mail', exact=True).fill(email)
        await owner.get_by_label('Senha', exact=True).fill(password)
        await owner.get_by_role('button', name='Entrar', exact=True).click()
        await expect(owner.get_by_role('heading', name='Restaurante do Ensaio', exact=True)).to_be_visible()
        await expect(owner.get_by_text('Pedidos pausados', exact=True)).to_be_visible()
        checked('Isolamento entre lojas, e-mail duplicado e novo login na loja correta')
        assert not errors, errors
        (OUTPUT/'results.json').write_text(json.dumps({
            'scenarios':passed, 'javascript_errors':errors,
            'payment_provider':'local-test-fixture; no money transferred',
        }, ensure_ascii=False, indent=2)+'\n')
        await browser.close()


asyncio.run(main())
