# Post-it de contribuições

O post-it amarelo aparece tanto no portal público quanto na área de funcionários. O topo permite arrastar por mouse ou toque; quando focado, as setas também movem o papel. A posição é limitada à parte visível da tela e reajustada ao redimensionar, girar o celular ou abrir o teclado. Recolher mantém uma faixa amarela acessível. A posição e o rascunho persistem neste navegador.

O primeiro texto digitado fixa a página de origem: caminho, seção e título. Trocar de página não muda a origem de um rascunho existente; **Usar a página atual** permite escolher a nova origem explicitamente. Na área de funcionários, as seções agora têm links como `/equipe#calendario`. O envio pode ser anônimo ou conter nome/apelido opcional. Categorias: impressão, melhoria e nova implementação.

As contribuições são reunidas em **Contribuições**, acessível a direção, supervisão e orientação. A equipe filtra por página, tipo e situação, percorre a lista em páginas de 30 registros e acompanha como **Nova**, **Em análise**, **Planejada** ou **Implementada**. Os textos enviados são mostrados como texto, e não como HTML. A listagem não é pública.

A migração aditiva `0011_site_feedback.sql` cria `site_feedback` no D1 existente. `POST /public/feedback` aceita texto de até 3000 caracteres, exige origem do próprio site e limita o corpo da requisição. Um identificador aleatório por navegador limita envios repetidos a 12 por hora e 50 por dia; não se coleta IP. A mesma anotação reenviada com o mesmo identificador não é duplicada. O limite por navegador evita repetição acidental; não substitui um serviço de proteção contra abuso distribuído.

`GET /api/feedback` e `PATCH /api/feedback/:id` exigem conta nominal ativa e perfil pedagógico. A alteração de situação usa versão para impedir sobrescrita concorrente e registra auditoria sem copiar o texto. Não há publicação automática no GitHub nem mensagens externas. As contribuições permanecem no banco privado do site.

A verificação externa de publicação usa `HEAD /public/feedback`: retorna 204 somente quando a tabela está disponível, sem expor nem criar contribuições. Os testes completos de envio utilizam exclusivamente banco sintético no runner da nuvem.
