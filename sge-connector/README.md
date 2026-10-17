# Conector SGE para Supervisão

## Versão no repositório: 1.3.1

O manifesto, a interface web e o ping atuais usam `1.3.1`, disponível na [Chrome Web Store](https://chromewebstore.google.com/detail/organizador-don%C3%ADcia-%E2%80%94-sup/pdkbopdpbenpapkdfkpffnfdaeccmbjf) com ícones e permissões mínimas (listagem pública conferida em 17/10/2026; oferecida por Assistente SGE). A base anterior `main` `32b11d8` usava `1.3.0`. O [PR11](https://github.com/marianojogos-art/OrganizadorDonicia/pull/11) integra a espera pelo carregamento real do SGE e registra publicação Cloudflare. O código também inclui consulta por trimestre e apresentação padronizada das turmas. A versão `1.2.3` e a leitura autenticada conferida no PR6 são referências históricas, não a versão atual do manifesto.

A espera confere a aba antes de injetar os scripts, evita o `about:blank` temporário e identifica redirecionamentos fora do SGE. A interface orienta a instalação pela loja e informa a versão detectada. Suporta sessões em `www.sgebr.com.br` e `www.sgebr.net.br` e páginas explicitamente vazias, incluindo paginação zero ou grade oculta.

Para instalar ou atualizar, use a [listagem pública Organizador Donícia — Supervisão SGE na Chrome Web Store](https://chromewebstore.google.com/detail/organizador-don%C3%ADcia-%E2%80%94-sup/pdkbopdpbenpapkdfkpffnfdaeccmbjf). Confirme a instalação na loja, mantenha o SGE e o Organizador no mesmo perfil do Chrome e recarregue o Organizador após instalar ou atualizar. Se não for detectado, confira se o conector está ativo nesse perfil. A Supervisão apresenta a versão detectada; não é necessário baixar um ZIP pelo site. No aplicativo Android, a conexão é integrada e as orientações próprias continuam válidas.

O ZIP recém-gerado mantém versão, ícones e permissões da fonte, mas limita o content script e o background à origem Organizador de produção. A pasta descompactada de desenvolvimento conserva suporte à demonstração loopback. Publicação do ZIP não atualiza automaticamente a extensão já instalada. Os testes simulados e o registro do PR11 não comprovam nova leitura em uma sessão autenticada; essa verificação permanece manual.

## Subseções e reinício da Supervisão

“Consultar turmas” reúne seleção de turmas, configuração do conector, progresso e atualização por Situação. “Trabalhar por professor” reúne seleção do professor, filtros, resultados, acesso à aprovação no SGE e relatório de ocorrências. Concluir uma consulta ou carregar resultados salvos abre automaticamente o trabalho por professor. Alternar as subseções preserva a consulta e a seleção.

“Reiniciar supervisão”, no início da aba, limpa a consulta e os filtros locais, incluindo turmas selecionadas, prévia, mensagens e contadores, e retorna à subseção de consulta. Não exclui dados compartilhados: os resultados podem ser carregados novamente. A revisão salva é preservada internamente para evitar sobrescritas concorrentes. O botão fica desativado durante consultas; respostas atrasadas de carregamento de dados salvos são ignoradas após o reinício.

## Diagnóstico de falhas de leitura

Os erros originais enviados pelo conector são preservados no relatório da turma e, quando a falha ocorre em um vínculo, no respectivo relatório de ocorrências e download. Antes desta correção, o adaptador substituía esses motivos por uma mensagem genérica. Etapas ausentes são identificadas como não consultadas, com possível interrupção. Mensagens são limitadas a 1000 caracteres, têm controles removidos e são escapadas na interface; respostas arbitrárias de rede continuam usando mensagens genéricas.

Para reproduzir uma falha, consultar apenas uma turma no Chrome ou Edge com o SGE e o Organizador no mesmo perfil. Copiar o motivo em “Ver falhas de leitura” e a etapa da consulta. Conferir a data de cada registro: dados anteriores preservados não representam uma nova leitura bem-sucedida. O motivo antigo descartado não pode ser recuperado; a nova tentativa permite capturá-lo. O ajuste de preservação dos erros é no site/API e não exige atualização da extensão.

## Resultados por professor e relatórios publicados

Os resultados oferecem uma lista de professores, ordenada pelo nome e selecionada por identidade. A tela mostra um professor de cada vez, com indicadores, filtros por Situação e planejamentos organizados por trimestre. Os controles de consulta ficam em “Consultar turmas”; resultados e relatórios ficam em “Trabalhar por professor”. A seleção permanece enquanto chegam novos registros na prévia.

O relatório de ocorrências é gerado para o professor selecionado e inclui todos os seus registros, independentemente dos filtros de Situação. Identifica pendências, registros em análise, situações e trimestres a conferir, falta de link direto, vínculos sem planejamento, falhas e registros antigos não encontrados. Cada ocorrência inclui um encaminhamento. Consultas parciais e erros sem nenhum registro também têm relatório; o download em texto inclui data, responsável quando disponível e falhas de cobertura. Os relatórios são derivados dos registros consultados, sem avaliação pedagógica automática.

“Aprovar no SGE” aparece nos planejamentos em análise que foram encontrados na última leitura. Abre o planejamento ou, quando não há link direto, a lista do professor para localizar o registro. A supervisora revisa e conclui a aprovação dentro do SGE, depois atualiza a consulta para confirmar a nova Situação. O conector continua somente de leitura e nenhuma aprovação é simulada no Organizador.

A instalação para uso da escola é feita pela [Chrome Web Store](https://chromewebstore.google.com/detail/organizador-don%C3%ADcia-%E2%80%94-sup/pdkbopdpbenpapkdfkpffnfdaeccmbjf). Entre no SGE, deixe a lista de turmas aberta no mesmo perfil do Chrome e recarregue o Organizador antes de consultar. O ZIP e a pasta gerados pelo build são artefatos técnicos de desenvolvimento/distribuição e não são o fluxo de instalação indicado ao usuário.

Entrar no SGE e deixar uma aba aberta na lista de turmas de planejamento (`hselgerenciamentoplanoaula.aspx`). O conector usa uma aba temporária no mesmo navegador para percorrer as páginas. Não recebe senha, não lê cookies e não transfere CPF ou HTML integral para o Organizador.

Na Supervisão, as pílulas mostram as turmas de todas as páginas, incluindo a segunda página. A lista completa é conferida pela paginação antes de oferecer a busca na escola inteira. A seleção só consulta professores e planejamentos após **Confirmar turmas e consultar planejamentos**. A busca usa o primeiro nome publicado na página de disciplinas, podendo receber o nome completo a partir dele; busca só por sobrenome não é suportada nessa lista. Os nomes completos retornados na página de planejamentos aparecem nos relatórios. Cada matrícula identifica um professor, evitando reunir homônimos.

O conector abre apenas as ações observadas nos arquivos fornecidos: `CONSULTA`, `PLANOPROF1` a `PLANOPROF10`, `CONSULTARPLANEJAMENTO` e navegação de páginas. Não clica na imagem de Situação nem nos botões de análise, alteração ou aprovação. A página 3 fornecida usa ações JavaScript com postback para abrir o conteúdo, e não contém URLs diretas dos registros; o conector tenta capturar o endereço após abrir cada consulta. Se o SGE não devolver uma página com URL própria, o relatório informa a falta do link e oferece o acesso ao professor. Endereços criptografados do SGE podem depender da sessão e expirar.

Trimestres informados para 2026: março a maio, junho a setembro e outubro a dezembro. Fevereiro e períodos que cruzem esses limites ficam em **Trimestre a conferir**. A síntese descreve a Situação retornada; não faz avaliação pedagógica do conteúdo. A última consulta por turma é compartilhada no D1 pela migração `0005_supervision.sql`; a tela também mantém prévia e filtros locais. Uma revisão global impede sobrescritas concorrentes. Somente o perfil de direção atual acessa a seção; não foi criado um perfil de supervisão.

Verificação em 06/10/2026: os três HTMLs fornecidos foram decodificados em Windows-1252 e lidos com os seletores reais. A primeira página contém 20 de 31 turmas, a segunda contém 72 vínculos de disciplina/professor, e a terceira contém 19 planejamentos (17 finalizados e 2 não enviados para análise). Com os meses informados, retornam 6 no primeiro trimestre, 7 no segundo, 3 no terceiro e 3 a conferir.

Os testes automatizados cobrem leitura, agrupamento, confirmação, permissão, paginação e navegação simulada do conector. A instalação e a leitura com postbacks foram posteriormente verificadas na sessão real durante a conclusão do PR6. A captura de links próprios continua dependendo do SGE; a ausência de um link direto é indicada no resultado. O Worker foi publicado em 06/10/2026, versão `cb53d961-10d4-4ec9-9b27-9e836caa3cb2`, com o ZIP disponível na seção Supervisão após o login institucional.

## Histórico de versões anteriores

O conector 1.1.0 envia o progresso da leitura de cada página de turmas e de cada planejamento. A interface mostra turma, professor, disciplina, número do planejamento, Situação, resultado do link e contadores de leituras e falhas. A prévia por professor aparece antes do encerramento da consulta e mantém os dados obtidos se a consulta for interrompida ou falhar. A versão anterior continua funcionando, com atualizações da prévia ao concluir cada vínculo de professor/disciplina; para atualizações de cada planejamento será necessário atualizar a pasta da extensão e recarregá-la após esta atualização.

A interface também oferece um filtro geral por Situação e um filtro independente em cada professor, tanto na prévia quanto no resultado por trimestre. As opções vêm das situações efetivamente retornadas pelo SGE, incluindo “Não informada”, com contagem por opção. Os filtros se combinam e podem ser limpos. A lista informa quantos planejamentos estão visíveis; a síntese mantém os totais da consulta completa. Os filtros permanecem selecionados enquanto novos planejamentos chegam na prévia. Esse ajuste foi publicado em 06/10/2026 na versão `d4783e1f-b86a-415c-8694-2fe628a11a74`, após os 62 testes passarem.

O conector 1.2.0 aceita atualizações seletivas: lê a lista do vínculo e abre apenas os planejamentos escolhidos pela Situação salva e os novos encontrados. Os registros preservados mantêm suas datas e links no Organizador. Substituir os arquivos da extensão e recarregá-la para usar essa otimização.

## Conector 1.3.0 — consulta por trimestre

A consulta permite escolher todos os períodos ou um trimestre: março a maio, junho a setembro e outubro a dezembro. O conector abre somente os planejamentos cujas datas estejam inteiramente no período selecionado. Períodos que cruzam trimestres aparecem em “Trimestre a conferir” ao consultar todos. O servidor valida o filtro novamente. Atualizações preservam registros e datas dos outros trimestres; apenas ausências dentro do período consultado são marcadas.

Os nomes das turmas são padronizados na apresentação e no relatório, preservando os identificadores do SGE. Exemplo fictício: “6º ano · Turma 61 · Matutino”.

O conector 1.2.1 reconhece as sessões do SGE em `www.sgebr.com.br` e `www.sgebr.net.br`. Substitua os arquivos da extensão pela nova distribuição, recarregue-a em Extensões e recarregue o Organizador. A consulta mantém o domínio da sessão aberta.

## Build, testes e publicação

Execute `npm run validate` na raiz para a validação conjunta. A suíte cobre parsing, paginação, seleção, filtros, permissões, navegação simulada e contratos com a ponte móvel. Veja [desenvolvimento](../docs/desenvolvimento.md).

Na conferência manual, instale o ZIP do commit revisado, confirme a versão detectada, faça login no SGE, consulte uma turma e confira filtro de trimestre, lista vazia, relatório de falhas e persistência após recarregar. Use dados autorizados e não publique capturas, relatórios ou HTML de produção no repositório.

O [guia de deploy](../docs/deploy.md) descreve prévia isolada e verificação do commit/ZIP após publicação. Um build local ou registro histórico não comprova o estado atual de produção.

## Preparação Chrome Web Store 1.3.1

O código atual prepara ícones e permissões mínimas para a loja, mantendo as consultas da1.3.0. A fonte/ping e a versão disponível na web estão em1.3.1. `npm run build` gera ZIP somente produção e pasta descompactada de desenvolvimento separada. Loja, cadastro, revisão e instalação não são comprovados pelo build. Veja [materiais de submissão](../docs/chrome-web-store/README.md) e [privacidade](PRIVACY.md).
