# Organizador Donícia — candidato Cloudflare Workers

Projeto escolar independente para a EBM Donícia Maria da Costa. Não usa recursos, conta ou ferramentas operacionais da Lepidus. Nenhum deploy, banco remoto, OAuth app ou segredo foi criado.

## Executar localmente

Requer Node.js 24 (SQLite nativo). Sem instalar dependências:

- `npm run build`: gera `dist/index.html` e `dist/app.js` a partir de `src/index.html`
- `npm test`: testes de API com SQLite real local, JWT RSA e contratos de renderização
- `npm run dev`: demonstração em `http://127.0.0.1:8787`, somente loopback, com direção fictícia e SQLite em `.local/demo-v3.sqlite`

A identidade fixa do servidor de demonstração está exclusivamente em `scripts/dev.mjs`. O Worker de produção não tem bypass nem modo demo. Reiniciar o servidor preserva o SQLite local. Não inserir dados reais de estudantes ou funcionários na demonstração.

## O que funciona

- Reservas: criar, listar, editar e cancelar pelo responsável ou direção; impedir sobreposição no banco de forma atômica; ocupação semanal fixa com período de validade
- Tarefas: criar/editar/remover, prazo, responsável nominal, estados; somente direção delega ou restringe; restritas são filtradas no servidor
- Substituições: registrar/editar/remover aula ausente, cadastrar/editar/desativar auxiliares, distribuir/trocar/retirar auxiliar, limite semanal configurável e horários sobrepostos; duplicidade de turma bloqueada; desativação libera as aulas futuras de forma atômica
- Xerox: solicitar, aprovar/devolver/recusar, produzir/concluir, ajustar e reenviar pedido devolvido; transições concorrentes usam compare-and-swap
- Atas: direção registra/edita/remove; equipe autorizada consulta
- Calendário: direção registra/edita/remove; equipe autorizada consulta
- Estudantes: desabilitado, sem tabela ativa nem rota. Proposta sintética em `db/proposals/`, fora das migrações, para revisão futura

Durante uma gravação, o formulário permanece protegido contra fechamento ou troca acidental. Se o banco salva e a atualização da lista falha, a interface informa que a alteração foi salva e oferece atualizar, evitando repetir a gravação.

Edições e remoções usam a versão do registro para detectar mudanças concorrentes. Auditoria registra ator, método, rota e horário na mesma transação, sem copiar conteúdo pessoal. Somente direção consulta os últimos 100 eventos.

## Acesso

O candidato usa Cloudflare Access como fronteira de identidade humana, compatível com provedor Google institucional a configurar. O Worker verifica a assinatura RSA do JWT, emissor, audience, validade e domínio `@prof.sc.gov.br`. Isso não autoriza todo o domínio: o e-mail deve existir e estar ativo na tabela `users`.

Perfis iniciais: `direction` e `teacher`. As permissões são verificadas na API. A escola ainda precisa confirmar quem recebe cada papel e se supervisão precisa de perfil próprio. Usuários são provisionados por migração administrativa revisada; não existe cadastro aberto.

## Banco

`migrations/0001_initial.sql` é a fonte executável do esquema SQLite/D1 e dos triggers. `db/schema.ts` descreve as tabelas para Drizzle. Não usar o resultado de `db:generate` como substituto dos triggers revisados. Nenhuma migração foi aplicada remotamente. Testes usam SQLite nativo, não o runtime D1.

Não há exportação de dados, uploads, anexos, notificações externas, importação SGE ou sincronização WebHorário. O link externo original permanece consulta manual.

## Antes de publicar

1. Confirmar conta Cloudflare autorizada, nome/projeto separado e domínio, preservando o site atual
2. Confirmar pessoas/perfis, política de tarefas restritas e responsáveis por aprovação de xerox
3. Criar recursos e configurar Access/Google apenas com autorização correspondente; preencher DB, ACCESS_ISSUER e ACCESS_AUD
4. Aprovar migração, provisionar usuários nominais, testar D1/Wrangler e login institucional real
5. Validar visual e fluxos em navegador desktop/mobile, CSP e recuperação do banco
6. Confirmar política escolar de 32 aulas por semana (configurável na tabela settings por migração administrativa), duração das aulas e cadastro de ocupação fixa
7. Para estudantes: definir finalidade, acesso, retenção, base de autorização e integração antes de ativar qualquer armazenamento

O `wrangler.jsonc` é intencionalmente incompleto e não publicável como está: ID do banco e identidade são placeholders; workers.dev e previews públicos desativados. Wrangler não foi instalado nem usado. Não há comando de deploy automático.

## Evidência e limites

Vinte e cinco testes locais passam. A suíte inicia/reinicia o servidor real local e percorre por HTTP substituições, auxiliares, reservas, tarefas, xerox, atas, calendário e ocupação fixa com dados sintéticos, verificando persistência de todos os módulos. Um smoke HTTP local verificou criar/listar reserva, servir assets e persistência após reinício do servidor. O build verifica sintaxe e separa JS para CSP. Os testes de UI verificam renderização de strings/escape e contratos, não um navegador real. O navegador de nuvem recusou localhost com `ERR_BLOCKED_BY_CLIENT`; não foi publicado um preview para contornar a restrição. Nenhuma captura visual ou teste responsive real foi obtido. D1 remoto, ambiente Workers, Google/Access, Drizzle generate e deploy ainda não foram verificados.
