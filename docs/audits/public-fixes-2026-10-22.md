# Correções da área pública — 22/10/2026

A [revisão de 21/10](public-2026-10-21.md) foi tratada na [PR 27](https://github.com/marianojogos-art/OrganizadorDonicia/pull/27). O post-it foi mantido por solicitação do responsável; sua adaptação conserva a cor, o arraste e o formulário.

## Correções entregues

- Consultas de agenda, conteúdo e destaques independentes. Falhas não apagam respostas válidas; cada seção afetada oferece explicação e nova tentativa.
- Calendário com carregamento e erro locais, validação do mês e ordenação por data, horário e título.
- “Nesta semana” distingue ausência de destaques de falha de consulta e não afirma que o mural inteiro está vazio.
- Ordem visual e de teclado alinhada no celular; títulos de documentos, nomes de links e avisos de nova aba corrigidos.
- Contrastes, foco sobre fundo escuro, textos auxiliares e controles de contato/autenticação melhorados.
- Apresentação compacta no celular; post-it recolhido de 204 px, campos de 16 px, botão de 44 px, Escape e formulário utilizável com altura reduzida.
- Identidade original preservada em três WebP com hash; cache longo limitado às imagens versionadas. HTML, scripts mutáveis, APIs e conteúdo interno continuam sem cache.
- Três projetos históricos, três documentos oficiais, seis datas da rede e um aviso com validade. [Fontes e critérios editoriais](../public-content-sources.md). Perfil institucional preenchido somente em campos vazios/neutros.

## Verificação em nuvem

[Validação](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/39718621566): 233 testes web, 14 testes do aplicativo, build, ensaio de recuperação, distribuição, dry-run Cloudflare e bundle móvel aprovados. [QA público](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/39718621581) em 320/390/768/1440 px e [QA do post-it](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/39718621632) com mouse, toque, teclado, altura reduzida, rascunho e recuperação aprovados.

A [conferência da página real](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/39718711767) confirmou os conteúdos publicados, ausência de overflow/imagens quebradas/erros de execução nas quatro larguras, alvos essenciais de 44 px, ordem de foco e recuperação independente das três fontes. [Verificação HTTP](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/39718621576) confirmou imagens WebP, cache apropriado e proteção das rotas internas.

O teste de toque usa movimento contínuo sem inércia e cliques nativos. O gesto anterior de salto instantâneo suprimia o clique no Chromium; isso não se reproduziu no gesto contínuo. A lógica original de arraste foi preservada.

A amostra controlada de carregamento usa Chromium, 390 px, DPR 2, latência de 150 ms e 1,6 Mbps. O hero usou 37.812 bytes, contra 1.497.321 bytes do PNG original: redução de 97,47%. LCP observado de 520 ms (h1), CLS 0, janela de observação de 2.512 ms. São dados de laboratório; não representam Core Web Vitals de usuários reais nem INP.

## Publicação e acompanhamento

Publicação confirmada em 2026-10-22T03:48:18.268Z: commit [acbc5d5](https://github.com/marianojogos-art/OrganizadorDonicia/commit/acbc5d5cbe29c3a90004e1431b4a3938e341a448), build `302bc4c9-b10d-4790-9dfd-e290cf7ac27d`, deployment `d2892772-1c44-4979-9265-ebc4bc8def0e`, versão `3a9d6a5b-657d-4022-9c42-755f3eed16d9` em 100% do tráfego. A carga confirmou 3 projetos, 3 documentos, 6 eventos públicos, 1 aviso e 14 registros de auditoria, sem alteração das identidades existentes.

As notas ficam na área da equipe, em **Contribuições → Histórico de atualizações publicadas**, com o commit e o build confirmados.

## Pendências editoriais e limites

Horários da secretaria e eventos específicos da escola continuam dependendo de confirmação. Instagram e Facebook limitaram a consulta automatizada; os projetos publicados vêm de fontes institucionais verificadas e têm os anos visíveis. Não se atribuiu conteúdo aos posts bloqueados.

Não houve envio de formulário ou mensagem em produção durante a conferência. As falhas 503 foram simuladas só no navegador de teste. A área interna foi verificada por testes sintéticos e proteção das rotas, sem usar credenciais de um professor real. Safari/iOS, Android físico e leitor de tela real não foram testados.
