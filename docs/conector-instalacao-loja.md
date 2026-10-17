# Instalação do conector SGE pela loja

A instalação indicada para o usuário é a [listagem pública Organizador Donícia — Supervisão SGE na Chrome Web Store](https://chromewebstore.google.com/detail/organizador-don%C3%ADcia-%E2%80%94-sup/pdkbopdpbenpapkdfkpffnfdaeccmbjf).

Listagem conferida publicamente em **17/10/2026**: nome Organizador Donícia — Supervisão SGE, oferecido por Assistente SGE, ID `pdkbopdpbenpapkdfkpffnfdaeccmbjf`, versão 1.3.1, atualização informada pela loja em 12/10/2026. A descrição associa o item à área de Supervisão do Organizador, consulta por trimestre e sessão SGE no mesmo perfil do Chrome. A página pública foi acessada; não foi usado o painel de desenvolvedor como link de instalação. Estes dados registram a conferência dessa data, sem presumir versões futuras da loja.

## Para instalar ou retomar a conexão

1. Abrir a listagem acima e confirmar a instalação pela Chrome Web Store no navegador.
2. Entrar no SGE no mesmo perfil do Chrome usado para acessar o Organizador e deixar aberta a lista de turmas dos planejamentos.
3. Recarregar o Organizador e usar Consultar turmas no SGE.
4. Após uma atualização pela loja, recarregar o Organizador. Se o conector não for detectado, conferir se está ativo no mesmo perfil do navegador.

A ajuda da Supervisão mostra esse fluxo e a versão detectada, quando disponível. Não é necessário baixar ZIP pelo site nem seguir a instalação manual antiga. O aplicativo Android continua apresentando sua conexão integrada; esta mudança de orientação web não altera nem publica um APK.

## Escopo e compatibilidade

A alteração atualiza somente interface, ajuda, documentação e testes. Código, manifesto, versão, permissões e distribuição da extensão permanecem iguais. Não altera credenciais, Access, dados escolares ou migrações. O arquivo técnico de distribuição e sua rota privada continuam disponíveis por compatibilidade; não são oferecidos como instalação na ajuda.

Os materiais de preparação da loja em `docs/chrome-web-store/` foram identificados como históricos. Os comandos de build desse material descrevem a reprodução técnica do pacote, não o procedimento que o usuário deve seguir para instalar.

## Verificação

- `npm run validate`: lint, TypeScript, testes raiz/mobile, build e consistência dos runtimes versionados.
- Teste da ajuda verifica endereço público exato, abertura segura em nova aba, versão detectada e ausência de passos ou link de instalação manual.
- `scripts/supervision-qa.mjs`: abre a ajuda em Chromium em 320/390/1440 px, confere link visível/sem overflow e preserva os cenários de seleção, exclusão de AEE, bloqueio, cancelamento e sucesso/erro com dados fictícios.
- O pacote técnico do conector é comparado à distribuição versionada, comprovando que a atualização da ajuda não modifica a extensão.

A disponibilidade da página pública não comprova instalação efetiva em um perfil pessoal nem consulta em SGE autenticado. Esses fluxos não foram executados. A publicação usa a integração Cloudflare existente; a inspeção autenticada da área privada de produção continua dependendo de acesso autorizado.
