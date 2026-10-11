---
name: sincronizar-projetos-github
description: Trabalhar nos projetos de Mariano na nuvem, consultar e integrar atualizações do GitHub antes das alterações, enviar commits pertinentes ao GitHub durante o trabalho e ao concluir, e publicar etapas utilizáveis na Cloudflare existente. Usar ao criar, editar ou retomar código, materiais ou arquivos de projetos com destino GitHub autorizado, inclusive esta habilidade. Não aplicar a conversas gerais nem publicar documentos privados ou dados pessoais automaticamente.
---

# Sincronizar projetos com GitHub

## Ambiente e escopo

- Trabalhar sempre no computador virtual/nuvem do assistente. Não usar o computador pessoal de Mariano como alternativa automática, nem para contornar bloqueios.
- Usar o computador pessoal somente quando Mariano o pedir explicitamente para a tarefa, ou após explicar a limitação concreta da nuvem e obter autorização específica. Se a nuvem estiver iniciando, aguardar sua disponibilidade. Uma autorização para determinada tarefa não vale para outras.
- Verificar o ambiente real antes de agir; seguir os mecanismos de acesso e delegação disponíveis. Não afirmar que a nuvem ou o computador pessoal está indisponível sem conferir.
- Aplicar o fluxo aos arquivos pertinentes do projeto e ao repositório correspondente já autorizado. Identificar proprietário, repositório, visibilidade e branch de destino. Se o destino estiver ausente ou ambíguo, pedir definição; não escolher arbitrariamente nem criar repositório público implicitamente.
- Não interpretar esta habilidade como autorização para enviar todo o conteúdo das conversas, arquivos pessoais, dados de alunos, segredos, credenciais ou outros dados sensíveis. Não ampliar permissões, criar credenciais, instalar acessos permanentes ou aceitar termos sem as confirmações exigidas.
- Respeitar instruções mais recentes de Mariano, políticas de confirmação e instruções do projeto. Uma habilidade descreve o procedimento; não substitui a autorização necessária para a ação concreta.

## Antes de começar as alterações

1. Identificar a cópia de trabalho na nuvem e ler as instruções do projeto. Registrar o estado inicial: raiz, remoto, branch, upstream, SHA atual, arquivos modificados, arquivos não rastreados e mudanças já preparadas. Evitar expor credenciais em URLs ou logs.
2. Consultar o GitHub de verdade. Em um checkout, usar `git status --short --branch`, `git branch --show-current`, `git rev-parse HEAD` e `git fetch <remoto>`; comparar a branch local com a branch remota pertinente. Se usar conector sem checkout, consultar a branch e o commit atual e ler as versões dos arquivos antes de alterá-los; não alegar ter executado fetch local.
3. Antes de integrar, preservar integralmente mudanças locais e arquivos não rastreados. Não incluir trabalho alheio no próprio commit nem guardar alterações indiscriminadamente. Se a árvore estiver limpa e houver somente avanço remoto, preferir avanço direto, como `git merge --ff-only <remoto>/<branch>`.
4. Em divergência ou árvore suja, examinar os diffs e escolher uma integração que preserve ambos os lados, por exemplo um worktree isolado ou uma cópia de segurança identificável antes de integrar. Não reescrever commits já publicados. Não usar `reset --hard`, `git clean`, force push ou descarte automático de arquivos.
5. Resolver conflitos por conteúdo, preservando a intenção das duas versões e executando validações. Não escolher automaticamente “ours” ou “theirs”. Se a resolução exigir uma decisão funcional incerta, apresentar os trechos e pedir a decisão; manter o trabalho preservado enquanto isso.
6. Se a consulta ao remoto falhar, informar que a versão mais recente não pôde ser conferida. Tentar apenas alternativas permitidas na nuvem. Não começar silenciosamente uma edição dependente da versão atual; pedir orientação quando não houver caminho seguro. Continuar somente atividades independentes desse bloqueio.

## Durante o trabalho

- Manter as alterações dentro do pedido e respeitar o que já existia. Mariano prefere acompanhar a versão atual na Cloudflare, sem gerenciar branches ou pull requests. Integrar na branch principal existente e autorizada conforme as permissões e proteções do projeto; não criar um fluxo obrigatório de branches para o usuário. Se uma proteção impedir o fluxo, explicar e pedir decisão, sem contorná-la.
- Não misturar tarefas concorrentes. Coordenar quem edita e publica cada conjunto de arquivos; preferir alterações isoladas em vez de compartilhar a mesma árvore ativa.
- Executar as verificações necessárias no computador virtual/nuvem: testes automatizados, lint, build ou revisão do artefato quando aplicáveis. Não exigir que Mariano teste localmente ou use seu computador. Registrar o que passou, falhou ou não pôde ser executado e por quê. A preferência por entregas rápidas não exige publicar um erro já conhecido.
- Examinar os arquivos que entrarão no commit. Excluir temporários, caches, dependências geradas sem necessidade, segredos e dados pessoais ou de alunos. Não confundir `.gitignore` com comprovação de segurança.

## A cada commit relevante e ao concluir

Enviar os commits pertinentes assim que formarem uma mudança coerente e revisada; não acumular tudo até o fim da tarefa. Repetir este fluxo de envio para cada marco relevante e conferir pendências no encerramento.

1. Revisar o diff e o estado completo, separando o trabalho desta tarefa das alterações preexistentes. Preparar somente os caminhos ou trechos pertinentes; não usar `git add .` indiscriminadamente.
2. Conferir novamente o remoto antes do envio. Se houve avanço, integrar com as mesmas salvaguardas e repetir as validações afetadas.
3. Criar um commit descritivo com as alterações pertinentes e enviá-lo ao repositório e branch autorizados. Se não houver alterações, não criar commit vazio: informar que não houve nada novo a enviar. Não fazer merge de pull request nem alterar visibilidade como consequência implícita do envio. Seguir a autorização de publicação na Cloudflare descrita abaixo; conferir antes se o próprio push dispara deploy automático.
4. Se o push for rejeitado por avanço remoto, buscar novamente e reconciliar sem force push. Limitar tentativas automáticas de corrida a três; se persistir, preservar o trabalho e comunicar o bloqueio. Falhas de autorização não permitem contornar controles.
5. Verificar o resultado no remoto com `git ls-remote` ou consulta equivalente do conector. Confirmar que o SHA enviado é a ponta da branch ou está contido no histórico remoto se outro commit já a avançou. Conferir também os arquivos esperados quando o envio ocorrer por API. Um commit local ou uma resposta de envio sem verificação não comprova sincronização.
6. Informar resumidamente o que foi atualizado, repositório/branch e link verificável do commit, resultado dos testes e qualquer pendência. Distinguir “salvo localmente”, “enviado” e “verificado no GitHub”. Nunca prometer sincronização concluída quando houver bloqueio.

## Publicação contínua na Cloudflare

- Ao concluir uma etapa utilizável e visível do projeto, publicar no projeto Cloudflare existente, correspondente e autorizado por Mariano, mantendo a versão mais recente disponível para ele acompanhar. Não exigir testes locais nem aprovação repetida para cada etapa já coberta por essa autorização.
- Identificar conta, projeto, domínio e mecanismo de publicação; conferir se há integração automática com a branch principal. Não duplicar deploys quando o push já os dispara. Se o alvo for ausente ou ambíguo, pedir definição. Novos serviços, custos, credenciais, permissões ou outros compromissos continuam sujeitos às confirmações exigidas.
- Antes de publicar, registrar o último commit e deployment saudáveis e confirmar um caminho de reversão. Verificar build e requisitos necessários na nuvem; não incluir dados privados, segredos ou arquivos de alunos. Mudanças destrutivas de banco, migrações incompatíveis e perda de dados não estão autorizadas por “se quebrar, revertemos”.
- Após o envio, acompanhar a execução até sucesso ou falha, consultar a URL real e verificar pelo menos carregamento, rota e funcionalidade alteradas. Quando possível, conferir qual SHA está servido; não equiparar GitHub atualizado a Cloudflare publicada e saudável. Se a verificação for limitada por autenticação ou falta de acesso, indicar exatamente o que não foi confirmado.
- Se o novo deployment falhar ou a aplicação apresentar regressão, tentar a correção segura no escopo. Quando necessário, restaurar o deployment saudável anterior ou criar um commit de reversão específico, conforme o mecanismo existente, sem apagar histórico nem reverter mudanças alheias. Verificar a recuperação na URL e alinhar o GitHub à versão recuperada; explicar quando o remoto ficar temporariamente à frente da versão servida.
- Não entrar em ciclos de deploy/reversão: se a causa persistir, houver efeitos em dados ou não for possível comprovar uma reversão segura, preservar a última versão saudável e comunicar o bloqueio. Informar ao usuário o link da etapa publicada, o que mudou, o resultado da verificação e eventuais reversões.

## A própria habilidade

Manter uma cópia exportável desta habilidade no repositório GitHub autorizado por Mariano. Incluir somente seu `SKILL.md` e `agents/openai.yaml`, salvo novos recursos pertencentes a ela e necessários ao funcionamento. Não copiar outras habilidades, instruções internas, configurações de autenticação ou infraestrutura da plataforma. Após atualizar a habilidade instalada, atualizar essa cópia quando o destino estiver definido e verificar o commit remoto. Se houver trabalho concorrente no projeto, entregar os arquivos ao responsável pela publicação para evitar disputa.
