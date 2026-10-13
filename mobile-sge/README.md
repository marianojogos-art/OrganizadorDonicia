# Organizador Donícia — aplicativo móvel

A versão 1.0.1 abre o próprio site publicado em um WebView para Android e iPhone. Telas, contas, permissões, validações, relatórios e dados são os mesmos do site. O aplicativo não cria banco local nem reimplementa módulos escolares.

## Estado da versão e limites de atualização

O pacote nativo nesta branch está em `1.0.1`, com `versionCode` Android `2`. Web, conector (`1.3.0`) e aplicativo têm ciclos próprios. O WebView carrega o site publicado, mas o runtime SGE é empacotado: correções precisam de novo instalador para chegar a instalações existentes.

A conciliação preserva os 17 commits originais do [PR10](https://github.com/marianojogos-art/OrganizadorDonicia/pull/10), incorpora a main `32b11d8` e a organização por merges, sem reescrever a branch original. Mantém os dois domínios SGE, campos dinâmicos, listas vazias, domínio atual na Lista de turmas, motivos de erro e controles de toque de pelo menos 48 px. A ponte informa aplicativo `1.0.1` e conector/protocolo `1.3.0`.

Os 14 testes móveis e 100 testes raiz passaram na conciliação de 11/10/2026; exportação Hermes não equivale a APK compilado/assinado/testado. Não foi gerado APK novo, nem executado login/SGE autenticado em aparelho. Consulte [verificação](../docs/verificacao.md) e [retomada](RETOMADA.md).

As ferramentas Windows e o APK abaixo registram 06/10/2026, não ferramentas no executor cloud nem acesso ao computador pessoal. O histórico de APK `1.0.0` permanece separado da preparação `1.0.1`.

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

É necessário entrar na conta Expo, criar/vincular o projeto EAS e configurar a assinatura antes de iniciar os builds. Para atualizar instalações existentes, reutilizar a chave Android já armazenada no EAS. Não gerar uma nova chave: o pacote e a assinatura precisam permanecer os mesmos. Para iPhone físico, a assinatura/distribuição requer a conta e as credenciais Apple apropriadas.

O projeto já foi vinculado a `@organizadordonicia/organizador-donicia` (ID `bafd8a08-833d-42ad-9265-cc14247b6514`). A chave Android foi criada no EAS. Build inicial do APK: [7dfac7fd-f4f9-4565-8e08-9b6c6f1fec09](https://expo.dev/accounts/organizadordonicia/projects/organizador-donicia/builds/7dfac7fd-f4f9-4565-8e08-9b6c6f1fec09). O status e o instalador estão na página do build; a distribuição iOS ainda depende das credenciais Apple.

```powershell
npx eas login --device
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

O padrão é `arm64-v8a`, para o Redmi Note 14 e outros Android de 64 bits. O parâmetro `-Architectures` aceita as arquiteturas suportadas pelo React Native. O script usa a versão do `package.json` no nome `artifacts/organizador-donicia-<versão>-android.apk` e inclui também `src/sge-origin.mjs` na cópia temporária. Ele inclui o JavaScript de produção e não depende do Expo Go nem de um servidor Metro para abrir.

Em 06/10/2026, o build local release terminou com sucesso (318 tarefas). O APK tem 26.413.378 bytes, inclui o bundle Hermes do Organizador e a ponte SGE, e sua assinatura v2 foi verificada com o mesmo certificado do EAS (`31ef008d878f9cf4a1f55aed7a18e695564872b047715cdf53c9d158268245ff`). SHA-256 do APK: `172e6efe025b3b0f5e8b72785844f37a13288ef61fd060b8a3e11a1ed7eb1f5b`. Instalação e uso desta versão no aparelho ainda precisam ser confirmados.

## Build Android 1.0.1

Na pasta `mobile-sge`, executar `npm ci` e entrar na conta Expo do projeto antes do build. O perfil `preview` gera APK instalável; `production` gera AAB para loja. O hook `eas-build-post-install` instala as dependências fixadas da raiz e regenera os dois runtimes durante o build remoto, usando o leitor compartilhado presente no mesmo arquivo enviado ao EAS.

```sh
npm run build:runtime
npm test
node node_modules/expo/bin/cli export --platform android --output-dir .export
node node_modules/eas-cli/bin/run build --platform android --profile preview --non-interactive
```

Manter o pacote `br.org.donicia.organizador`, o projeto EAS existente e sua chave de assinatura. Para instalar uma atualização, abrir o novo APK no Android e confirmar a atualização do aplicativo existente. Não desinstalar a versão anterior. O APK gerado, credenciais e dependências ficam fora do GitHub.

## Verificação

Em 06/10/2026, 86 testes do site, conector e aplicativo passaram. Um teste de integração executa a confirmação de turmas e a consulta móvel usando o JavaScript real do site e salva o resultado pela API existente no banco fictício. A exportação Hermes compilou os bundles para Android e iOS.

A conexão do protótipo anterior com o SGE foi confirmada pelo usuário em um Redmi Note 14. A versão completa 1.0.1 ainda precisa ser validada no aparelho, incluindo o login institucional e a leitura integrada à Supervisão. Não há simulador iOS ou emulador Android neste ambiente.

Paginação de disciplinas/planejamentos e mudanças de estrutura do SGE mantêm as limitações do conector: a leitura falha com aviso em vez de apresentar dados incompletos como consulta completa. Manter o aplicativo em primeiro plano durante consultas ao SGE.

Referências: [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/), [distribuição interna](https://docs.expo.dev/build/internal-distribution/), [TestFlight](https://docs.expo.dev/submit/testflight/).
