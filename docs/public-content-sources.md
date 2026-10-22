# Conteúdo público verificado — 22/10/2026

A migração `0018_verified_public_content.sql` cadastra três projetos históricos, três documentos oficiais, seis datas do calendário da rede e um aviso de orientação. A publicação desses conteúdos foi autorizada pelo responsável na tarefa de correção e publicação do portal. A pesquisa foi realizada em nuvem, sem navegador pessoal.

## Projetos e memória da escola

| ID estável | Referência temporal | Evidência pública |
| --- | --- | --- |
| `public-casan-saneamento-2025` | Reportagem publicada em 08/04/2025 | [CASAN — educação ambiental e saneamento](https://www.casan.com.br/noticia/index/url/estudantes-de-florianopolis-aprendem-sobre-saneamento-em-novas-regioes-atendidas-por-obras-de-esgoto). A Donícia é mencionada entre as escolas participantes do Programa Socioambiental na região Saco Grande–Monte Verde. |
| `public-mind-lab-acervo-2020` | Acervo institucional de 2020; dia de publicação não informado | [Sala de Jogos Mind Lab](https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta2020/sala-de-jogos-mind-lab). A página reúne atividades por módulos e etapas de ensino. |
| `public-tecnologia-acervo-2020-2021` | Registros institucionais de 2020 e 2021; dia de publicação não informado | [Espaço Interativo / Sala Informatizada](https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta/espa%C3%A7o-maker). A página apresenta jogos, leitura, criação de histórias e segurança na internet. |

Os títulos e as descrições deixam os anos visíveis. Esses registros não afirmam que os projetos continuam ativos em 2026. Os totais de participantes da reportagem da CASAN abrangem várias escolas e não são atribuídos à Donícia. Não foram copiadas fotos, nomes de estudantes, contatos pessoais de docentes ou arquivos incorporados nos acervos.

O Instagram oficial não forneceu publicações verificáveis na consulta em nuvem; o Facebook apresentou bloqueio da Meta. Nenhum conteúdo desta migração é atribuído a posts dessas redes. Os links sociais existentes permanecem como canais da escola.

## Documentos úteis

| ID estável | Documento / orientação | Verificação |
| --- | --- | --- |
| `public-calendario-rede-2026` | [Calendário letivo 2026 — PDF oficial](https://www.pmf.sc.gov.br/arquivos/arquivos/pdf/11_02_2026_14.52.28.d1ab0ae914d208faa7585414fd4202ca.pdf) | PDF de uma página aberto; vinculado pela [página da SME](https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0). |
| `public-matriculas-orientacoes-sme` | [Matrículas e transferências — página oficial](https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=matriculas+++ensino+fundamental&menu=7&submenuid=253) | A página reúne orientações de 2026 e 2027, incluindo as Portarias 717/2026 e 719/2026 e os documentos anteriores de 2026. O portal direciona as famílias à fonte; não reproduz prazos não verificados. |
| `public-residencia-matricula-2027` | [Declaração de residência — Anexo I da Portaria 719/2026](https://www.pmf.sc.gov.br/arquivos/arquivos/pdf/07_10_2026_12.05.47.a022234847077504d638eee5d33cfaae.pdf) | PDF oficial de uma página, publicado em 06/10/2026. As condições de uso e os documentos complementares permanecem na fonte oficial. |

Os documentos são links HTTPS públicos; não há cópia de arquivos para a biblioteca interna. A data automática `updated_at` corresponde ao cadastro/edição no portal, não à publicação histórica da fonte. A verificação das fontes ocorreu em 22/10/2026.

## Calendário público e aviso

A página e o PDF oficiais da SME confirmam as datas abaixo para a Rede Municipal de Ensino de Florianópolis:

- 02/11/2026: Finados.
- 15/11/2026: Proclamação da República.
- 20/11/2026: Dia Nacional de Zumbi e da Consciência Negra.
- 18/12/2026: término do ano letivo de 2026.
- 19 a 31/12/2026: recesso escolar.

São datas da rede, não eventos exclusivos da Donícia. O esquema guarda uma data por evento; `start` e `end` são horários. Por isso, o recesso tem dois marcos explícitos (início e término), com o intervalo completo nas descrições. O marco de 31/12 não significa retorno às aulas em 2027. Todos os eventos são públicos, sem horário, sem formação e identificados como calendário da rede.

O aviso `public-matriculas-orientacoes-2026-10` orienta famílias a consultar os documentos oficiais e a secretaria. Sua data é 22/10/2026, a validade termina em 31/12/2026 e o destaque fica ativo até 31/10/2026. **Essas são datas de exibição do aviso, não prazos de matrícula.** Nenhum prazo de inscrição foi inferido.

## Preservação dos dados e auditoria

- Cada registro novo usa ID estável e `INSERT OR IGNORE`: uma colisão preserva integralmente o registro existente, inclusive rascunhos e alterações da gestão. Reaplicar a migração não republica itens retirados pela equipe.
- A autoria técnica é vinculada a um usuário de gestão já existente e ativo, priorizando direção, supervisão e orientação. Nenhuma identidade é criada nem exposta na documentação. A ação de auditoria `SEED_PUBLIC_CONTENT` identifica uma carga autorizada por migração; não representa um login ou clique feito por essa conta.
- Sem gestor ativo, a migração não cadastra conteúdo nem altera contatos. Na implantação, conferir apenas as contagens esperadas e a integridade dos dados, sem registrar identidades em logs públicos.
- Cada inserção efetiva é acompanhada de auditoria; registros ignorados não geram auditorias falsas. Executar a migração na transação fornecida pelo D1.
- O perfil só recebe endereço, telefone e e-mail nos campos vazios. Os valores são os mesmos já verificados em `src/public.html` e [no cadastro municipal da escola](https://servicos.floripa.sc.gov.br/atendimento/servico-info/659). A introdução vazia ou neutra recebe a apresentação já publicada na página; introduções personalizadas, horários, WhatsApp e contatos personalizados são preservados.
- Não foi confirmado horário de atendimento da secretaria; nenhum horário foi presumido. Não há mudanças em pedidos, reservas, formação interna, biblioteca privada ou dados de estudantes.
- Os testes verificam gestor ativo, ausência de provisionamento, privacidade da API pública, datas e validade, preservação de colisões/edições, reexecução sem alterações e reversão do lote quando a auditoria falha. O teste D1 existente verifica que o evento interno legado continua oculto mesmo após a carga pública.
