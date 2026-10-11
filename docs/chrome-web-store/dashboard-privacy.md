# Campos de privacidade — base para revisão do titular

## Propósito único

Consultar turmas, docentes e metadados de planejamentos do SGE para a Supervisão do Organizador Donícia, com a sessão autorizada do usuário e a escola configurada no sistema.

## Justificativas de permissões

**scripting:** injeta o leitor JavaScript empacotado nas páginas SGE autorizadas para extrair campos de turmas, professores e planejamentos e acionar somente consultas/paginação. Não executa código baixado da internet.

**host_permissions — https://www.sgebr.net.br/sge8105/* e https://www.sgebr.com.br/sge8105/*:** permitem identificar a aba SGE autenticada, consultar páginas e percorrer suas listas no domínio da sessão. O código valida origem/caminho e recusa navegação fora do SGE. O Chrome pode apresentar avisos baseados nos hosts mesmo com caminhos delimitados; não prometer ausência de avisos.

**content_script — https://organizadordonicia.carijo.workers.dev/*:** conecta os controles da Supervisão à extensão e entrega prévia/resultados ao Organizador. O ZIP de loja não possui match loopback. A pasta de desenvolvimento continua separada.

A permissão `tabs` foi retirada: a API de abas é usada para criar/navegar/fechar a aba de consulta, mas acesso às URLs SGE já é coberto pelos hosts. Não adicionar storage/cookies/history/webRequest ou hosts amplos para contornar erros.

## Código remoto

Resposta técnica proposta: **Não usa código remoto.** Leitor, seletores e controlador são incluídos em background.mjs/page-runtime.js no ZIP; não há import de JS/WASM remoto, eval ou new Function no pacote auditado. A navegação SGE usa o site existente; não baixa uma nova implementação do conector. A lógica do conector permanece no pacote. Validar o pacote final antes de declarar.

## Tipos de dados — não marcar “nenhum dado”

| Campo do dashboard | Proposta fundamentada | Observação |
| --- | --- | --- |
| Informações de identificação pessoal | Sim | Nomes e matrículas docentes; site registra nome/email do responsável ao salvar. |
| Conteúdo de sites | Sim | Turmas, disciplinas e metadados/títulos/situações de planejamentos. |
| Histórico da Web | Declarar o tratamento limitado de URLs SGE | Guarda URLs necessárias a origem/links; não consulta histórico geral do Chrome. A categoria exata deve ser conferida no formulário atual. |
| Atividade do usuário | Declarar quando aplicável à definição apresentada | Seleção, consulta, salvamento/atualização e trilha do responsável no Organizador. Não monitoramento geral de cliques/teclas. |
| Informações de autenticação | Não há leitura direta de senha/cookie | Sessão usada pelo Chrome. URLs SGE têm parâmetros opacos; não atestar que nunca contenham identificador sensível sem análise real. |
| Financeiro, saúde, localização, comunicações pessoais | Sem funcionalidade de coleta desses tipos no leitor auditado | Campos livres da fonte podem conter informação inserida por terceiros; não emitir garantia absoluta sobre conteúdo externo. |

O tratamento não termina na extensão: mensagens → Organizador → HTTPS API → Cloudflare D1 ao salvar, acesso da direção autorizada, relatórios para download. Extensão sem armazenamento próprio não significa ausência de dados persistidos. Reiniciar/desinstalar não apaga o D1. Não há expiração automática nem endpoint de exclusão específico; informar a prática real administrativa.

## Contato público confirmado

Privacidade e suporte: **assistentesge@gmail.com**, informado e autorizado pelo titular em 11/10/2026. Usar este endereço nos campos correspondentes da loja; não trocar pelo e-mail de login da conta. Não enviar credenciais ou relatórios reais em chamados técnicos.

## Certificações que exigem confirmação do titular

Não assinalar automaticamente os compromissos legais com base apenas na auditoria. O código não implementa venda/ads/analytics ou uso para crédito, mas o titular deve confirmar práticas externas, compartilhamento, uso limitado, autoridade institucional e retenção/exclusão. Também confirmar identidade do publicador, países/status comercial e finalidade de distribuição.

## Teste para revisores

O produto depende de login institucional Cloudflare Access e sessão SGE da escola. Não colocar senha, cookie, URL de sessão ou conta nominal real neste arquivo público. O titular deve confirmar método de teste privado permitido no dashboard, com acesso autorizado e dados sintéticos; não conceder acesso à produção/escola nem criar conta sem autorização específica. A captura demonstrativa não substitui um fluxo autenticado testável pelos revisores.

## Fontes oficiais consultadas em 11/10/2026

- [Campos de privacidade](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy): finalidade, permissões mínimas, código remoto e declarações de dados.
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): scraping e tratamento local também exigem transparência.
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use): finalidade e limites de uso dos dados.
- [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs): diferença entre usar API de abas e pedir acesso amplo às suas propriedades.
- [Código hospedado remotamente](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code): empacotar a lógica MV3.
