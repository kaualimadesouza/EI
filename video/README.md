# Vídeos de apresentação do TOPA

Filme **Da fila ao fluxo**, em quatro cards e com 30 segundos. Público: lojistas
de pequenos e médios estabelecimentos de alimentação. Narração em português,
legendas abertas, trilha instrumental original e telas reais do app.

| Arquivo | Formato |
| --- | --- |
| [topa-horizontal.mp4](topa-horizontal.mp4) | 1920 × 1080, 16:9, 30 fps |
| [topa-vertical.mp4](topa-vertical.mp4) | 1080 × 1920, 9:16, 30 fps |
| [legendas.srt](legendas.srt) | Legendas também disponíveis para edição |
| [storyboard-horizontal.jpg](storyboard-horizontal.jpg) | Conferência dos enquadramentos horizontais |
| [storyboard-vertical.jpg](storyboard-vertical.jpg) | Conferência dos enquadramentos verticais |

Os MP4s usam H.264, áudio AAC estéreo e início rápido para reprodução na web.
A versão vertical tem composição própria e margens reservadas para legendas e
interfaces de redes sociais.

## Recriar os vídeos

Execute na raiz do repositório. Precisa de [uv](https://docs.astral.sh/uv/), Python
3.13 ou superior e `ffmpeg`/`ffprobe` no PATH. O uv usa `pyproject.toml` e
`uv.lock` para preparar o ambiente.

```bash
uv run --locked --project video python video/tools/build.py
```

Esse comando reutiliza as capturas, a fonte e os trechos de voz versionados.
Refaz a trilha e os efeitos, sincroniza as legendas, renderiza as duas
composições, gera os storyboards e valida os arquivos. Depois da instalação das
dependências, os insumos salvos permitem renderizar sem conexão com a internet.

O processamento intermediário fica em `.work/`, ignorado pelo Git. Para gerar
somente os storyboards:

```bash
uv run --locked --project video python video/tools/build.py --preview-only
```

Para exportar apenas uma proporção:

```bash
uv run --locked --project video python video/tools/build.py --format vertical
```

## Atualizar as telas depois de mudar o app

Precisa também de Node 24 e das dependências de `topa/web`. Prepare o frontend e
o navegador:

```bash
cd topa/web
npm ci
cd ../..
uv run --locked --project video playwright install chromium
uv run --locked --project video python video/tools/build.py --refresh-captures
```

O capturador inicia o Vite local com `VITE_API_URL` vazio, percorre os fluxos e
fecha o servidor ao terminar. Cardápio e pedidos vêm dos adaptadores locais;
os pedidos do painel são fictícios. O processo não cria pedidos na API
publicada. A fonte salva é servida ao navegador durante a captura.

As imagens são salvas em `assets/screens/`. `manifest.json` registra a revisão
do código, a data e as dimensões. A porta padrão é 5188; `TOPA_VIDEO_PORT`
permite alterá-la. `TOPA_VIDEO_CHROMIUM` permite indicar um executável de
Chromium já instalado.

## Atualizar a narração

O texto falado e seus intervalos estão em `tools/audio.py`: `SEGMENTS` define os
quatro cards e `PHRASES` agrupa as legendas. Mantenha os dois coerentes ao editar.

```bash
uv run --locked --project video python video/tools/build.py --refresh-voice
```

Essa opção usa a rede para enviar somente o texto ao serviço de voz, por meio
de `edge-tts`. Voz: `pt-BR-FranciscaNeural`. Os MP3s e os tempos das palavras são
salvos em `assets/voice/`; a renderização normal reutiliza esses arquivos.
O serviço pode mudar ou ficar indisponível, por isso a voz original fica salva.

## Organização dos códigos e insumos

- `tools/paths.py`: caminhos relativos ao repositório e destinos dos QR Codes.
- `tools/build.py`: preparação dos insumos e execução do processo completo.
- `tools/capture.py`: navegação automatizada no app local e capturas com Playwright.
- `tools/audio.py`: voz, marcações das legendas, trilha e efeitos sintetizados.
- `tools/render.py`: composições, tipografia, comandas, aparelhos e animação por frame.
- `tools/validate.py`: duração, resolução, codecs, contagem de frames e leitura
  do QR Code em três instantes de cada vídeo, depois da compressão, além de
  nível de áudio e pico real.
- `assets/`: fonte Lexend, capturas, QR Codes e trechos de voz usados na produção.

As cores são lidas de `topa/web/src/index.css`. Marca e fotografias vêm dos
arquivos originais do repositório. Créditos das fotos em
[`topa/web/PHOTOS.md`](../topa/web/PHOTOS.md); licença da Lexend em
[`assets/fonts/OFL.txt`](assets/fonts/OFL.txt). Trilha e efeitos são gerados pelo
código, sem amostras de músicas de terceiros.

## Roteiro, pesquisa e validação

O [roteiro](roteiro.md) foi escrito antes da montagem e revisado por um agente
sem o histórico da conversa. Após os ajustes, o parecer foi **aprovado para
montagem**. A [pesquisa de referências](referencias.md) registra as fontes, os
casos e as decisões aplicadas.

O CTA é **Explore o cardápio**. URL e QR Code levam a
`https://topa-totem.vercel.app`, a experiência pública do cliente. O vídeo não
anuncia acesso aberto ao painel nem uma condição comercial inexistente.

A conferência técnica é salva em [validacao.json](validacao.json). Para repetir:

```bash
uv run --locked --project video python video/tools/validate.py
```

Reveja os storyboards e os vídeos ao mudar títulos, narração, proporções ou
telas. A validação automática cobre o arquivo exportado; a clareza da mensagem
e a qualidade estética também precisam de inspeção visual.
