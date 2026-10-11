# Privacidade — Conector SGE do Organizador Donícia

Atualização técnica: 11/10/2026. Código preparado para loja: 1.3.1. Esta política descreve o tratamento implementado; antes da submissão, o titular deve confirmar os responsáveis, contato e práticas administrativas indicados ao final.

## Finalidade e uso

O conector consulta turmas, professores e metadados de planejamentos do SGE para a Supervisão do Organizador Donícia. É destinado à escola configurada no Organizador, com sessão SGE e acesso institucional já autorizados. Não é um produto oficial do SGE, Google ou Prefeitura e não aprova, altera ou exclui planejamentos no SGE.

A consulta é iniciada pelos controles da Supervisão. O Chrome usa a sessão já existente para navegar nas páginas SGE em uma aba temporária. A extensão não lê diretamente sua senha, cookies ou CPF e não concede acesso novo ao SGE.

## Dados tratados

- Identificadores e nomes de turmas, ano, série, etapa e turno.
- Nomes e matrículas docentes, vínculos e disciplinas.
- Identificadores, títulos/períodos, datas, quantidade de aulas, inclusão, situação e URLs de planejamentos; datas alimentam a classificação por trimestre.
- Progresso, cobertura, falhas e datas de consulta. O Organizador registra a conta institucional responsável (nome/email), revisões e auditoria ao salvar.

O leitor não extrai o HTML integral, o corpo pedagógico do planejamento ou uma lista de estudantes. Campos livres e URLs do SGE podem conter informação inserida naquela fonte; links são preservados com seus parâmetros e devem ser tratados como informação institucional. Não se promete ausência absoluta de informação pessoal nesses campos.

A extensão identifica somente páginas dos hosts `www.sgebr.net.br` e `www.sgebr.com.br` dentro de `/sge8105/`, e comunica-se com o Organizador correspondente. Não utiliza API de histórico geral, cookies, publicidade ou analytics. O pacote da loja não habilita a demonstração em loopback.

## Transmissão, acesso e armazenamento

Os dados são enviados à página do Organizador por mensagens internas do navegador. A página os utiliza na prévia e, quando os resultados são salvos, envia o snapshot por HTTPS à API do Organizador. O Worker valida e persiste relatórios no Cloudflare D1. A versão atual restringe a Supervisão ao perfil de direção institucional ativo/autorizado. Resultados salvos podem ser consultados pela equipe com esse perfil, não apenas por quem iniciou a consulta.

Nomes/matrículas, vínculos, metadados normalizados, URLs, cobertura e falhas podem permanecer nos relatórios. Nem todo campo transitório é persistido: quantidade de aulas e horário de inclusão não são campos próprios do snapshot normalizado; datas contribuem para o trimestre. O Organizador também permite baixar relatórios textuais. Quem os baixa deve tratar essa cópia conforme as regras institucionais.

Cloudflare fornece a infraestrutura do site/API/banco e Cloudflare Access controla o login do Organizador. Chrome e SGE administram a sessão SGE; o código do conector não copia cookies para a API. Não há transmissão a serviço de publicidade, venda de dados ou rastreamento analítico implementados no pacote auditado. Práticas externas ao código devem ser confirmadas pelo titular antes das certificações da loja.

## Retenção e solicitações

A extensão não mantém banco próprio nem usa `chrome.storage`, localStorage ou IndexedDB. Isso não elimina a persistência no D1. Reiniciar a tela, recarregar ou desinstalar a extensão não apaga os relatórios escolares. Não existe prazo automático de expiração ou rota específica de exclusão da Supervisão implementada nesta versão. Retenção, revisão de acesso e exclusão administrativa devem ser definidas e atendidas pelo responsável institucional; não se promete exclusão automática.

O código e a descrição técnica são públicos em [marianojogos-art/OrganizadorDonicia](https://github.com/marianojogos-art/OrganizadorDonicia). [Issues](https://github.com/marianojogos-art/OrganizadorDonicia/issues) recebem dúvidas técnicas sem dados pessoais; não publique relatórios reais, nomes/matrículas, links de sessão ou credenciais nesse canal. Solicitações sobre dados institucionais devem utilizar o contato de privacidade confirmado pelo titular.

## Confirmação necessária antes da submissão

O titular ainda deve informar identidade do publicador/responsável, contato de privacidade e suporte, vínculo/autorização institucional e regras administrativas de retenção/exclusão. Esses campos não foram inventados. A publicação desta descrição técnica no GitHub não representa certificação jurídica, aceite de termos ou confirmação dessas práticas.
