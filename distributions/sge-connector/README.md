# Distribuição do conector SGE

Pacote **Organizador Donícia — Supervisão SGE 1.3.1**, gerado das fontes no commit `ef3cf6fd26f295a5aa090b47da0bb067e68b7f58`. Publicado no repositório a pedido do usuário em 11/10/2026 para obtenção pelo navegador cloud; não é uma release nem comprovação de publicação/aprovação na Chrome Web Store. Esta autorização específica permite versionar este ZIP, sem ampliar a regra geral de exclusão de artefatos do projeto.

- Arquivo: [organizador-donicia-sge-1.3.1.zip](organizador-donicia-sge-1.3.1.zip).
- Tamanho: 24,763 bytes.
- SHA-256: `a0337e33f79dd306bf766ff385a6b3b405f6e5d5a4672a93202b555e9131c17e`.
- [Materiais da loja](../../docs/chrome-web-store/README.md) e [política pública](../../sge-connector/PRIVACY.md). As imagens existentes continuam válidas para 1.3.1 e usam dados fictícios.

No GitHub, abra o arquivo ZIP e use **Download raw file**. Não use o ZIP geral do repositório para upload na loja. Para um endereço imutável, substitua `main` pelo SHA do commit de distribuição no link raw.

Reprodução: execute `npm ci` e `npm run validate` na raiz; compare `dist/sge-connector.zip` com este arquivo. O CI verifica igualdade byte a byte e checksum. Atualizações do código do conector exigem regenerar o pacote e sua documentação; não alterar um ZIP manualmente.

O pacote tem oito arquivos com manifesto na raiz: background, bridge, runtime e quatro ícones, além do manifesto. Manifesto MV3, Chrome mínimo120, apenas permissão `scripting`, hosts SGE restritos e origem Organizador de produção. Não inclui loopback, banco, credenciais, documentos ou dependências. CRC e ícones conferidos; nenhum código remoto ou padrão de chave privada identificado nos scripts. Isso não substitui revisão Google, teste da extensão instalada ou consulta SGE autenticada. O Access do Organizador permanece privado.
