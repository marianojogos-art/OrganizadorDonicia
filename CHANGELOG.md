# Histórico de mudanças

Este arquivo registra mudanças verificáveis no Git. Datas são de integração/documentação; não significam release, APK novo ou publicação atual. Não havia tags ou releases publicadas na referência auditada `main` `32b11d8` em 11/10/2026. Versões web, extensão e aplicativo são independentes.

## 14/10/2026 — sugestões da equipe e métricas do portal

- Supervisão com cancelamento lógico e descarte de retornos tardios, grupos de turmas e revisão de situações reais; sem escrita no SGE ou alteração da extensão.
- Solicitações internas de mensagem/materiais, álbum privado com imagens limitadas, biblioteca categorizada de links, agenda derivada e verificador designado nas tarefas.
- Botão WhatsApp da secretaria com número exato autorizado, orientação sem número ativo; referências oficiais da rede/BNCC, sem inventar documentos ou números da escola.
- Migrações aditivas 0012/0013 preparadas; dados sintéticos e validações locais documentados em [sugestões](docs/sugestoes-2026-10.md). Push e publicação no Worker existente autorizados; conclusão verificada pela CI e workflow HTTP, sem criar release.

- Painel restrito de métricas agregadas: visualizações, estimativa de abas/dia e cliques por seção/WhatsApp, intervalo UTC selecionável, preferências DNT/GPC e limites de abuso. Migração aditiva 0014; nenhum serviço externo, identificador bruto ou IP armazenado nas métricas.

## 12/10/2026 — reservas, xerox, formação e notas pessoais

- `bdae6e1`: turma/disciplina e responsável nas agendas, datas inclusivas com recorrência semanal e conflitos atômicos, mantendo permissão da direção para horários fixos.
- `4689c88`: professor, turma e impressão de xerox; anexo privado PDF/PNG/JPEG até 256 KiB no D1 existente, validação e download por proprietário/direção.
- `c7c18e6`: Formação integrada ao calendário, com horário/local/informações e filtros, sem criação de eventos ou duplicação de registros.
- `3d1f1a7`: notas pessoais por login, com consultas/edições/exclusões filtradas por dono na API, sem acesso especial da direção.
- Migrações aditivas preservam IDs, dados e permissões anteriores. Código SGE, versão da extensão 1.3.1, Access e audiência permanecem iguais. Não é release ou novo APK.
- [Guia e evidências](docs/melhorias-2026-10.md): validações locais, QA sintético no Chromium, limites de anexos e limites de confirmação de produção.

## 11/10/2026 — conector1.3.1 preparado para loja

- Ícones PNG, Chrome mínimo120, retirada da permissão redundante tabs e ZIP somente produção, mantendo variante de desenvolvimento.
- Informação visível de dados/transmissão/salvamento na Supervisão, política técnica pública e materiais PT-BR com imagens fictícias identificadas.
- Não registra submissão, aprovação da loja ou novo APK. Campos do titular e método de revisão autenticada ainda precisam confirmação.

## 11/10/2026 — organização e conciliação integradas

- [PR12](https://github.com/marianojogos-art/OrganizadorDonicia/pull/12), merge `a2f66db`: documentação web `2.0.0`/conector `1.3.0`, CI e habilidade exportável de sincronização.
- [PR13](https://github.com/marianojogos-art/OrganizadorDonicia/pull/13), merge `25a92ef`: Android `1.0.1`/versionCode 2 conciliado com main, preservando os 17 commits originais do PR10. Ponte SGE `1.3.0`; runtime regenerado; nenhum novo APK assinado ou teste físico.
- Guias de contribuição, desenvolvimento, testes, deploy e evidências de distribuição.
- CI e validação conjunta adicionadas para lint, typecheck raiz, testes raiz/móvel, build, runtimes consistentes e exportação Expo; não publica produção.
- Inventário de branches e recomendação de proteção preparados para revisão, sem remoção remota ou aplicação de regras.

Integrações autorizadas por Mariano após a auditoria. CI e publicação são verificadas separadamente em [verificação](docs/verificacao.md); não foram criadas tags ou releases.

## 11/10/2026 — base main `32b11d8`

- [PR11](https://github.com/marianojogos-art/OrganizadorDonicia/pull/11), commit `8789a40`: espera pelo carregamento real da aba SGE antes de injetar scripts, evitando `about:blank` temporário.
- Commit `05655a8`: consulta por trimestre e nomes claros de turmas.
- Commit `455167a`: compatibilidade da Supervisão com a versão atual e runtime SGE atualizado.
- Manifesto/interface/ping do conector `1.3.0`. O PR11 registra publicação Cloudflare; não há nova comprovação de APK ou sessão física por esse registro.
- [PR10](https://github.com/marianojogos-art/OrganizadorDonicia/pull/10): proposta Android `1.0.1` ainda separada na auditoria, com conflitos e commits exclusivos. Preservar a branch e reconciliar antes de anunciar integração/distribuição.

## 10/10/2026 — documentação e agenda

- [PR9](https://github.com/marianojogos-art/OrganizadorDonicia/pull/9): documentação dos estados e limites de atualização do site, extensão e aplicativo.
- [PR8](https://github.com/marianojogos-art/OrganizadorDonicia/pull/8), merge `bcebc67`: agenda mensal por espaço, seleção do dia, contagem e reserva com data/espaço preenchidos. A documentação daquela revisão registra 94 testes raiz e build aprovados.
- [PR7](https://github.com/marianojogos-art/OrganizadorDonicia/pull/7): navegação/leiaute adaptados a telas pequenas. Emulação de viewport não comprova aparelho físico.

## Histórico anterior — PRs1–6 e aplicativo inicial

- [PR1](https://github.com/marianojogos-art/OrganizadorDonicia/pull/1): resultados por professor e relatório de ocorrências.
- [PR2](https://github.com/marianojogos-art/OrganizadorDonicia/pull/2): diagnóstico e preservação de motivos de falha SGE.
- [PR3](https://github.com/marianojogos-art/OrganizadorDonicia/pull/3): subseções e reinício da Supervisão preservando resultados compartilhados.
- [PR4](https://github.com/marianojogos-art/OrganizadorDonicia/pull/4), [PR5](https://github.com/marianojogos-art/OrganizadorDonicia/pull/5), [PR6](https://github.com/marianojogos-art/OrganizadorDonicia/pull/6): domínios SGE, navegação inicial, listas vazias e extensão `1.2.3`; prévia D1 separada documentada.
- O README móvel registra build Android `1.0.0` de 06/10/2026 e exportação Android/iOS. Instalação/validação da versão completa no aparelho permanecem evidências distintas; o relato não comprova distribuição `1.0.1`.

Detalhes funcionais estão nos READMEs dos componentes. Para cada nova revisão, registre o PR/commit e resultados atuais; não reutilize totais antigos de testes como validação nova.
