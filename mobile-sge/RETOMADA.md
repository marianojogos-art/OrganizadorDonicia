# Retomada do APK Android 1.0.1

Estado registrado em 10/10/2026: atualização implementada, 14 testes móveis aprovados e exportação do bundle Android Hermes concluída (601 módulos). O novo APK ainda não foi gerado nem instalado no aparelho.

## Continuar em outro computador

Clonar o repositório e selecionar a branch `codex/app-android-1-0-1`. Usar Node.js 24 e instalar as dependências fixadas:

```sh
git clone https://github.com/marianojogos-art/OrganizadorDonicia.git
cd OrganizadorDonicia
git switch codex/app-android-1-0-1
npm ci
cd mobile-sge
npm ci
npm run build:runtime
npm test
node node_modules/expo/bin/cli export --platform android --output-dir .export
node node_modules/eas-cli/bin/run login --device
node node_modules/eas-cli/bin/run whoami
node node_modules/eas-cli/bin/run build --platform android --profile preview --non-interactive
```

Entrar na conta Expo `organizadordonicia` e concluir a confirmação do dispositivo no próprio computador. Não transportar tokens, sessões ou credenciais locais. O projeto EAS já está configurado: `bafd8a08-833d-42ad-9265-cc14247b6514`.

Reutilizar a chave Android existente no EAS e manter o pacote `br.org.donicia.organizador`. A versão é `1.0.1`, com `versionCode` 2. SHA-256 do certificado histórico: `31ef008d878f9cf4a1f55aed7a18e695564872b047715cdf53c9d158268245ff`. Não gerar uma nova chave: a atualização precisa da mesma assinatura do aplicativo anterior.

## Pendências

1. Gerar o APK com o perfil `preview`, baixar e verificar pacote, versão, assinatura e SHA-256 do arquivo.
2. Registrar o link do build e a validação em `README.md` desta pasta.
3. Instalar como atualização do aplicativo existente, sem desinstalar. Testar login, conexão SGE, consulta na Supervisão e agenda mensal no celular.

O leitor SGE 1.2.3 atualizado está empacotado nos runtimes. O WebView usa o site publicado, que já contém leiaute móvel e agenda mensal. O código não depende de arquivos locais de outro PC. Seguir `AGENTS.md` para publicação e autorização de merge; o pedido de gerar o APK está autorizado, mas não equivale a autorizar outro deploy do site.
