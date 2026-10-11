# Organizador Donícia — aplicativo móvel

A versão 1.0.0 abre o próprio site publicado em um WebView para Android e iPhone. Telas, contas, permissões, validações, relatórios e dados são os mesmos do site. O aplicativo não cria banco local nem reimplementa módulos escolares.

## Estado da versão e limites de atualização

O pacote nativo permanece em `1.0.0`. O site, o conector de navegador (`1.3.0` na base atual) e o aplicativo nativo têm ciclos de versão diferentes. A publicação dos PRs7/8 atualizou o site carregado pelo WebView, incluindo o leiaute móvel e a agenda mensal, mas **não gerou nem distribuiu um novo APK/IPA**. O runtime SGE injetado é empacotado no aplicativo: correções no leitor compartilhado precisam ser regeneradas e incluídas em outro build nativo para chegar a uma instalação existente.

A base `main` `32b11d8` contém versão nativa `1.0.0`. O [PR10](https://github.com/marianojogos-art/OrganizadorDonicia/pull/10) propõe compatibilidade Android `1.0.1`; a branch original deve ser preservada durante a conciliação com a web/conector atuais. Consulte `package.json` e `app.json` do commit revisado para identificar a versão efetiva. Não existe evidência de novo APK `1.0.1` compilado, assinado e testado apenas porque essa versão aparece no código.

Os comandos de validação atuais estão em [desenvolvimento](../docs/desenvolvimento.md). Testes, typecheck, runtime e exportação Expo são verificações de código/bundle; não substituem instalação física. As ferramentas de Windows e o APK citados abaixo são registros de 06/10/2026, não ferramentas presentes no executor cloud nem uma solicitação de acesso ao computador do usuário.

## Uso

1. Abra o aplicativo e faça o login institucional do Organizador.
2. Use as abas e os formulários do próprio site normalmente. Alterações aparecem no computador porque são gravadas pela mesma API no mesmo D1.
3. Para consultar o SGE, toque em **SGE**, faça login e abra a lista de turmas de planejamento. Toque em **Concluir conexão**.
4. Na **Supervisão** do Organizador, consulte as turmas, confirme a seleção e acompanhe a prévia. Filtros, trimestres, sínteses, atualização por Situação e salvamento compartilhado continuam sendo feitos pelo site.
5. Links de planejamentos abrem no navegador SGE do aplicativo, usando a mesma sessão. O botão Organizador retorna ao site sem fechar essa sessão.

A área do SGE apenas conecta o navegador ao protocolo usado pelo site. A navegação de leitura é compartilhada com a extensão em `../src/sge-reader.mjs`, e os seletores são os de `../src/sge-pages.mjs`. A senha e os cookies não são enviados pela ponte. As sessões são administradas pelos WebViews; para sair, use os comandos de logout do Organizador e do SGE.

## Abrir no Expo Go

Após instalar as dependências, gere o runtime e inicie o servidor:

```powershell
node scripts/build-runtime.mjs
node node_modules/expo/bin/cli start --tunnel --port 8084
```

O túnel permite testar remotamente, sem depender da mesma rede Wi-Fi. O link temporário abre o aplicativo no Expo Go. O modo LAN também pode ser usado com `--lan`.

Em outro computador, executar `npm ci` na pasta principal do repositório e nesta pasta. O gerador de runtimes usa o esbuild da pasta principal. O Metro observa `../src` para compartilhar o leitor do SGE, sem copiá-lo para outro projeto.

## Instaladores próprios

`eas.json` contém os perfis:

- `preview`: APK Android e distribuição interna iOS.
- `production`: AAB Android e distribuição iOS por loja/TestFlight.

É necessário entrar na conta Expo, criar/vincular o projeto EAS e configurar a assinatura antes de iniciar os builds. Para Android, o EAS pode gerar a chave do aplicativo. Para iPhone físico, a assinatura/distribuição requer a conta e as credenciais Apple apropriadas.

O projeto já foi vinculado a `@organizadordonicia/organizador-donicia` (ID `bafd8a08-833d-42ad-9265-cc14247b6514`). A chave Android foi criada no EAS. Build inicial do APK: [7dfac7fd-f4f9-4565-8e08-9b6c6f1fec09](https://expo.dev/accounts/organizadordonicia/projects/organizador-donicia/builds/7dfac7fd-f4f9-4565-8e08-9b6c6f1fec09). O status e o instalador estão na página do build; a distribuição iOS ainda depende das credenciais Apple.

```powershell
npx eas login --device
npx eas init
npx eas build --platform android --profile preview
npx eas build --platform ios --profile production
```

No ambiente Windows usado em 06/10/2026, a renomeação atômica em AppData falha. O auxiliar ignorado `../.tools/eas-local.cjs` usa `.expo` para as configurações e a sessão do EAS. Não publicar essas pastas ou compartilhar os arquivos de autenticação.

### Histórico de compilação Android no Windows

JDK 17 e Android SDK foram instalados de forma portátil em `../.tools/android-local`. O SDK contém plataforma 36, Build Tools 35.0.0 e 36.0.0, NDK 27.1.12297006 e CMake 3.22.1. Não é necessário instalar o Android Studio para executar o build.

O script `scripts/build-android-local.ps1` gera os runtimes, prepara o projeto Android quando necessário, compila a versão release e verifica a assinatura. Usa a mesma chave Android do EAS, em `credentials.json` e `credentials/android/keystore.jks`, ambos ignorados pelo Git. Nunca compartilhar esses arquivos.

Naquela sessão, `Q:` apontava temporariamente para a raiz do repositório via `subst`, para encurtar os caminhos das ferramentas. O script compila automaticamente em `%TEMP%/dnc/a`, uma cópia temporária sem credenciais, para evitar acentos, caminhos longos e mistura de raízes do Windows. Copia o leitor compartilhado para a pasta temporária e devolve o APK ao projeto original; não cria outra implementação do aplicativo. Java usa UTF-8. Executar no PowerShell:

```powershell
Set-Location Q:\mobile-sge
./scripts/build-android-local.ps1
```

O padrão é `arm64-v8a`, para o Redmi Note 14 e outros Android de 64 bits. O parâmetro `-Architectures` aceita as arquiteturas suportadas pelo React Native. O APK verificado é copiado para `artifacts/organizador-donicia-1.0.0-android.apk`. Ele inclui o JavaScript de produção e não depende do Expo Go nem de um servidor Metro para abrir.

Em 06/10/2026, o build local release terminou com sucesso (318 tarefas). O APK tem 26.413.378 bytes, inclui o bundle Hermes do Organizador e a ponte SGE, e sua assinatura v2 foi verificada com o mesmo certificado do EAS (`31ef008d878f9cf4a1f55aed7a18e695564872b047715cdf53c9d158268245ff`). SHA-256 do APK: `172e6efe025b3b0f5e8b72785844f37a13288ef61fd060b8a3e11a1ed7eb1f5b`. Instalação e uso desta versão no aparelho ainda precisam ser confirmados.

## Verificação

Em 06/10/2026, 86 testes do site, conector e aplicativo passaram. Um teste de integração executa a confirmação de turmas e a consulta móvel usando o JavaScript real do site e salva o resultado pela API existente no banco fictício. A exportação Hermes compilou os bundles para Android e iOS.

A conexão do protótipo anterior com o SGE foi confirmada pelo usuário em um Redmi Note 14. A versão completa 1.0.0 ainda precisa ser validada no aparelho, incluindo o login institucional e a leitura integrada à Supervisão. Não há simulador iOS ou emulador Android neste ambiente.

Paginação de disciplinas/planejamentos e mudanças de estrutura do SGE mantêm as limitações do conector: a leitura falha com aviso em vez de apresentar dados incompletos como consulta completa. Manter o aplicativo em primeiro plano durante consultas ao SGE.

Referências: [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/), [distribuição interna](https://docs.expo.dev/build/internal-distribution/), [TestFlight](https://docs.expo.dev/submit/testflight/).
