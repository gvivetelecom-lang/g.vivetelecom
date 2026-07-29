name: Deploy a GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch: # permite disparar el deploy manualmente desde la pestaña Actions

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # No hay proceso de build (React puro vía CDN, sin bundler),
      # así que se publica el contenido del repo tal cual está.
      # Si en algún momento se agrega un paso de build, va acá antes
      # del upload-pages-artifact.

      - name: Configurar Pages
        uses: actions/configure-pages@v5

      - name: Subir artefacto
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.' # cambiar a './public' o similar si se organiza en subcarpeta

      - name: Publicar en GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
