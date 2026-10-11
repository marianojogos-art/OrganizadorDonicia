# Preparação Chrome Web Store — 1.3.1

Pacote destinado a **novo item Organizador Donícia — Supervisão SGE**. Não atualizar outro Assistente SGE da conta. Este diretório contém materiais revisáveis; não registra submissão, aprovação ou publicação na loja.

## Arquivos e reprodução

- `listing.pt-BR.md`: descrição e URLs.
- `dashboard-privacy.md`: propósito, permissões/dados e pendências do titular.
- [Política técnica pública](../../sge-connector/PRIVACY.md): contato público assistentesge@gmail.com confirmado; precisa confirmar identidade e práticas administrativas antes de certificar.
- `assets/supervisao-demonstracao-1280x800.png` e `supervisao-consulta-1280x800.png`: capturas da interface real no Chromium154, estado e turmas sintéticos; aviso explícito de demonstração, sem consulta real SGE.
- `assets/promocional-440x280.png`: composição gráfica original do documento/consulta, sem marcas oficiais. Ícone128 e tamanhos menores em `sge-connector/icons/`, incluídos no pacote.

```sh
npm ci
npm run validate
npm run check:cloudflare
```

`npm run build` gera `dist/sge-connector.zip`, **o ZIP de produção para a loja**, com manifesto na raiz e oito arquivos: manifesto, bridge, background, page-runtime e quatro ícones PNG. É uma allowlist; documentação, screenshots, testes, dependências, banco e segredos não entram. A pasta `dist/sge-connector/` conserva match loopback para desenvolvimento; o ZIP elimina esse match e compila background somente para origem Organizador produção. Não zipar a pasta inteira ou o repositório.

Versão1.3.1 prepara ícones, limite Chrome120, permissões mínimas e esclarecimento de privacidade. Mantém a consulta por trimestre/leitor1.3.0. O app nativo continua1.0.1 com seu runtime/protocolo1.3.0, sem novo APK. `tabs` foi removida porque os hosts já cobrem URL das abas SGE. O Worker mantém Access e permissões existentes; a política é pública pelo GitHub, sem abrir rota do aplicativo.

## Validação efetiva

`npm run validate` aprovado: 101 testes raiz e 14 móveis, sintaxe JS/JSX, tipagem TS raiz, build e consistência dos runtimes. Teste específico confere manifesto/permissões/tamanhos dos ícones. Inspeção do ZIP confirmou CRC, lista de arquivos, versão1.3.1, hosts restritos e ausência de loopback no manifesto/background. Bundles contêm lógica local; nenhum JS/WASM remoto, eval/new Function, analytics ou chave privada foi identificado no pacote.

Não há declaração de teste físico/SGE autenticado. O Chromium do executor bloqueia `Extensions.loadUnpacked` com “Loading of unpacked extensions is disabled by the administrator”; flags de carregamento não produziram ponte ativa. Não contornar essa política. Capturas são reais da interface web demonstrativa, não prova da extensão instalada. O executor de dashboard deve conferir upload/validação e método autorizado de teste para revisores.

## Fontes oficiais consultadas em 11/10/2026

- [Preparar extensão](https://developer.chrome.com/docs/webstore/prepare): manifesto/versão/descrição e ZIP com manifesto na raiz.
- [Imagens](https://developer.chrome.com/docs/webstore/images): PNG128, captura1280×800 (ou640×400), tile440×280.
- [Publicação](https://developer.chrome.com/docs/webstore/publish): campos, submissão e revisão Google; upload não equivale a aprovação.
- [Ficha](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) e [privacidade](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

## Pendências para submissão real

Contato público de privacidade/suporte confirmado: **assistentesge@gmail.com**. Ainda confirmar identidade do titular e autoridade institucional, retenção/exclusão e certificações sobre práticas externas. Confirmar distribuição/status comercial/países quando solicitados. Acesso para revisores precisa método privado autorizado; não fornecer credenciais/contas reais em repositório público nem alterar Access para facilitar revisão. Cadastro e envio na loja são coordenados por outro executor; não duplicar essa ação.

## Transferência de artefatos

O executor de upload informou falha Library `403 scope_violation` nos ZIPs existentes. Não baixar os mesmos IDs por outra rota nem criar novos IDs para contornar essa negativa. Não houve reenvio dos artefatos por este executor nesta retomada. Os documentos e imagens originais permanecem no GitHub autorizado; o usuário pode reanexar o pacote no contexto de upload quando desejar. A versão do código continua 1.3.1, e a atualização de contato não altera os bytes da extensão nem exige recriar imagens.
