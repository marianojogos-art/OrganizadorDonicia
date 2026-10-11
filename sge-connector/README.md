# Conector SGE para Supervisão

## Versão publicada: 1.2.3

O [PR6](https://github.com/marianojogos-art/OrganizadorDonicia/pull/6) publicou a versão `1.2.3`. Ela aceita sessões em `www.sgebr.com.br` e `www.sgebr.net.br`, ignora o carregamento temporário de uma aba vazia e reconhece páginas explicitamente sem planejamentos, mesmo quando o SGE retorna paginação zero ou mantém uma grade oculta. Falhas reais continuam sendo informadas.

A leitura autenticada foi validada, e os resultados compartilhados persistiram após recarregar o Organizador. O ZIP publicado e os arquivos instalados neste PC foram conferidos na conclusão do PR6. Os PRs7/8 modificam o leiaute e a agenda, mantendo o conector `1.2.3`. A versão `2.0.0` do pacote principal pertence ao site, não à extensão; o aplicativo nativo tem versão própria.

Para atualizar a extensão, baixe o ZIP na Supervisão, substitua os arquivos da pasta instalada, abra `chrome://extensions` (ou a página de extensões do Edge), recarregue **Organizador Donícia — Supervisão SGE** e depois recarregue o Organizador. Confira `1.2.3` nos detalhes da extensão. Mantenha SGE e Organizador no mesmo perfil do navegador.

## Melhoria preparada no conector 1.3.0

A espera pelo SGE confere o estado atual da aba antes de injetar os scripts e identifica redirecionamentos fora do SGE. A tela informa a versão disponível e a detectada.

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

O build gera `dist/sge-connector.zip` e a pasta `dist/sge-connector/`. No Chrome ou Edge, abrir Extensões, ativar o modo de desenvolvedor e carregar essa pasta como extensão descompactada. Recarregar o Organizador após instalar. A seção Supervisão oferece o ZIP publicado para download após login.

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

## Builds da Cloudflare e isolamento do banco

O estado de produção verificado, com o commit e a versão Cloudflare, está no [README principal](../README.md#estado-verificado-após-o-pr8--10102026). A `main` publica com `npm run deploy:cloudflare`, aplicando somente migrações pendentes antes de servir os assets.

A falha inicial da prévia do PR4 foi resolvida com o banco separado `donicia-school-preview`, criado após autorização e inicializado com as cinco migrações. `wrangler.jsonc` distingue o D1 de produção (`donicia-school`) do D1 de prévia, tanto em `preview_database_id` quanto no bloco `previews`. Não usar o banco de produção para contornar falhas de prévia. `preview_urls: false` mantém as URLs públicas de prévia desativadas.

Na correção do PR4, a branch foi validada com `npm test && npx wrangler d1 migrations apply donicia-school --remote --preview && npx wrangler preview`. Configurações específicas de branches no painel são externas ao Git; conferir **Settings → Builds** antes de alterar um comando. Um build local ou de prévia não comprova publicação em produção: conferir commit, status **Ready**, tráfego ativo e, quando a extensão mudar, a versão do ZIP e da instalação.
