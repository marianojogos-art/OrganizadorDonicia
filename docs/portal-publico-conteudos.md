# Página pública: semana, projetos e documentos

A gestão em **Comunicação** permite cadastrar projetos e documentos públicos, separados do álbum privado e da biblioteca interna. Somente direção, supervisão e orientação podem administrar. Professores e visitantes não recebem rascunhos, autores, versões ou arquivos privados.

- Projetos: título, assunto, apresentação, link HTTPS opcional e imagem JPEG/PNG até 256 KiB com descrição acessível. A confirmação de autorização é obrigatória em cada salvamento publicado, incluindo alterações de texto ou imagem.
- Documentos: assunto, título, orientação, link HTTPS público e data de atualização automática. Nenhum arquivo é copiado automaticamente; a equipe deve verificar o acesso público no destino.
- Rascunhos não são publicados. Retirar a publicação também retira imediatamente o acesso à imagem; respostas de dados e imagens usam no-store.
- Avisos: validade opcional inclusiva até o fim do dia em America/Sao_Paulo. Após esse prazo, saem da API pública e dos destaques, permanecendo na gestão. Sem prazo, os avisos antigos mantêm o comportamento anterior.
- Nesta semana: próximos eventos públicos de hoje até domingo, além de até dois avisos vigentes cuja data não seja futura. A semana vai de segunda a domingo no horário da escola. A agenda completa continua disponível.
- Nenhum conteúdo fictício é incluído em produção; telas vazias orientam as famílias para a secretaria. Os dados de teste vivem somente nos bancos sintéticos da CI.

## Endpoints e proteção

GET /public/content retorna apenas os metadados publicados. GET /public/projects/:id/image retorna somente JPEG/PNG de projeto publicado. A API canônica /public/api mantém suas três chaves anteriores. /api/public-content exige Access, usuário nominal ativo e papel pedagógico; escritas exigem mesma origem, JSON limitado, versão para edição/exclusão e auditoria atômica.

Migração 0016 é aditiva: acrescenta expires_on com padrão vazio aos avisos e cria public_content. Não copia nem altera conteúdo privado ou destrói registros. Em reversão de código, manter o esquema aditivo e os dados. Checkpoint anterior: 2b4c942d8659d1a2296f519ecbeca79231e33c41, versão Cloudflare 3adea5f6-160c-4ee5-adca-4edb5319b796.

## Validação

Testes de API cobrem papéis, CSRF, confirmação de publicação, links, imagens, retirada de publicação, versões, auditoria e expiração. Testes de interface verificam semana no fuso da escola, escape de texto, agrupamento, datas, estados de erro e formulários. Public design QA usa Chromium na nuvem em 320/390/768/1440 px, com dados sintéticos e captura visual. Resultado efetivo registrado no relatório da entrega.

Na primeira visita pública, o post-it de contribuições começa recolhido no canto inferior para deixar a identidade e os atalhos visíveis. O visitante pode expandir e mover; preferências e rascunhos existentes são preservados. A área da equipe conserva sua abertura padrão.
