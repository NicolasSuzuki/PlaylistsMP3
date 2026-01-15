# PlaylistMP3

Downloader de playlists ou albuns do Spotify para MP3 via YouTube.

## O que faz
- Le uma URL de playlist/album do Spotify no terminal.
- Busca as faixas no Spotify.
- Para cada musica, pesquisa no YouTube e baixa o melhor audio em MP3.
- Salva em `downloads/<tipo>-<id>`.

## Requisitos
- Node.js 18+ (ESM).
- `ffmpeg` disponivel no PATH (necessario para converter para MP3).
- Credenciais do Spotify (Client ID/Secret) e um `SPOTIFY_REFRESH_TOKEN`.

## Instalacao
```bash
npm install
```

## Configuracao
Crie um arquivo `.env` na raiz do projeto:
```env
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret
REDIRECT_URI=http://localhost:8888/callback
SPOTIFY_REFRESH_TOKEN=seu_refresh_token
```

Observacao: o fluxo atual usa `SPOTIFY_REFRESH_TOKEN` e falha se ele nao estiver definido.

## Uso
```bash
node index.js
```

Siga o prompt e cole a URL de uma playlist ou album do Spotify.

## Saida
Os arquivos sao salvos em:
```
./downloads/<tipo>-<id>/
```

## Notas
- A busca no YouTube e feita por `nome da musica + artistas`.
- Se um download falhar, o erro e logado e o processo continua.
- Respeite os termos de uso do Spotify e do YouTube.
