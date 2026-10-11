# Histórico de mudanças

Este arquivo registra mudanças verificáveis no Git. Datas são de integração/documentação; não significam release, APK novo ou publicação atual. Não havia tags ou releases publicadas na referência auditada `main` `32b11d8` em 11/10/2026. Versões web, extensão e aplicativo são independentes.

## Em revisão — organização e validação

- Documentação alinhada à base web `2.0.0`, conector `1.3.0` e aplicativo `1.0.0`; Android `1.0.1` tratado como integração separada.
- Guias de contribuição, desenvolvimento, testes, deploy e evidências de distribuição.
- CI e validação conjunta adicionadas para lint, typecheck raiz, testes raiz/móvel, build, runtimes consistentes e exportação Expo; não publica produção.
- Inventário de branches e recomendação de proteção preparados para revisão, sem remoção remota ou aplicação de regras.

Esta seção descreve o trabalho do PR em revisão. Seu resultado depende do SHA final e das verificações anexadas; não anuncia implantação.

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
