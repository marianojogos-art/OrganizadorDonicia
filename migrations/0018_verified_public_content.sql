-- Verified public content, researched on 2026-10-22; provenance: docs/public-content-sources.md.
-- Apply atomically through D1 migrations. No new users, private data or student images.
-- Stable IDs preserve every existing row, including manager edits or unpublished drafts.
-- A populated installation must already have an active pedagogical manager.
-- Empty/synthetic installations are intentionally left without seeded content.

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-casan-saneamento-2025','project','Educação ambiental e saneamento — 2025','A Donícia está entre as escolas participantes do Programa Socioambiental da CASAN na região Saco Grande–Monte Verde. A reportagem de 8 de abril de 2025 apresenta ações educativas sobre água, saneamento e preservação ambiental realizadas com escolas da região.','Meio ambiente','https://www.casan.com.br/noticia/index/url/estudantes-de-florianopolis-aprendem-sobre-saneamento-em-novas-regioes-atendidas-por-obras-de-esgoto',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-casan-saneamento-2025',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-casan-saneamento-2025' FROM public_content
WHERE id='public-casan-saneamento-2025' AND changes()>0;

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-mind-lab-acervo-2020','project','Sala de Jogos Mind Lab — acervo 2020','O portal institucional de 2020 reúne atividades da Sala de Jogos Mind Lab organizadas por módulos e etapas de ensino. Explore esse acervo histórico de jogos e propostas de aprendizagem da Donícia.','Memória da escola','https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta2020/sala-de-jogos-mind-lab',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-mind-lab-acervo-2020',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-mind-lab-acervo-2020' FROM public_content
WHERE id='public-mind-lab-acervo-2020' AND changes()>0;

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-tecnologia-acervo-2020-2021','project','Tecnologia e aprendizagem — acervo 2020–2021','A Sala Informatizada reúne no portal institucional propostas de jogos, leitura, criação de histórias e uso responsável da internet. Os registros de 2020 e 2021 preservam experiências de aprendizagem com tecnologias educacionais.','Memória da escola','https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta/espa%C3%A7o-maker',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-tecnologia-acervo-2020-2021',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-tecnologia-acervo-2020-2021' FROM public_content
WHERE id='public-tecnologia-acervo-2020-2021' AND changes()>0;

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-calendario-rede-2026','document','Calendário letivo 2026 — rede municipal','Consulte no PDF oficial as datas letivas, os feriados e os recessos definidos pela Secretaria Municipal de Educação de Florianópolis para 2026.','Calendário escolar','https://www.pmf.sc.gov.br/arquivos/arquivos/pdf/11_02_2026_14.52.28.d1ab0ae914d208faa7585414fd4202ca.pdf',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-calendario-rede-2026',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-calendario-rede-2026' FROM public_content
WHERE id='public-calendario-rede-2026' AND changes()>0;

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-matriculas-orientacoes-sme','document','Matrículas e transferências — orientações oficiais','Acesse as orientações e os documentos da Prefeitura para matrículas e transferências no Ensino Fundamental. A página oficial reúne as informações de 2026 e 2027; confira os critérios, as etapas e os prazos correspondentes à sua situação.','Matrículas e transferências','https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=matriculas+++ensino+fundamental&menu=7&submenuid=253',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-matriculas-orientacoes-sme',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-matriculas-orientacoes-sme' FROM public_content
WHERE id='public-matriculas-orientacoes-sme' AND changes()>0;

INSERT OR IGNORE INTO public_content(id,kind,title,description,category,url,published,creator)
SELECT 'public-residencia-matricula-2027','document','Declaração de residência — matrícula 2027','Formulário oficial vinculado à Portaria nº 719/2026, publicado em 6 de outubro de 2026. Confira as condições de uso e os documentos exigidos na página oficial de matrículas da Prefeitura.','Matrículas e transferências','https://www.pmf.sc.gov.br/arquivos/arquivos/pdf/07_10_2026_12.05.47.a022234847077504d638eee5d33cfaae.pdf',1,email
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-residencia-matricula-2027',creator,'SEED_PUBLIC_CONTENT','/api/public-content/public-residencia-matricula-2027' FROM public_content
WHERE id='public-residencia-matricula-2027' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-finados','Finados — calendário da rede','2026-11-02','Feriado',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Feriado nacional previsto no calendário letivo 2026 da rede municipal. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-finados',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-finados' FROM events
WHERE id='public-rede-2026-finados' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-republica','Proclamação da República — calendário da rede','2026-11-15','Feriado',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Feriado nacional previsto no calendário letivo 2026 da rede municipal. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-republica',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-republica' FROM events
WHERE id='public-rede-2026-republica' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-consciencia-negra','Dia Nacional de Zumbi e da Consciência Negra','2026-11-20','Feriado',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Feriado nacional previsto no calendário letivo 2026 da rede municipal. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-consciencia-negra',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-consciencia-negra' FROM events
WHERE id='public-rede-2026-consciencia-negra' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-termino-letivo','Término do ano letivo 2026 — rede municipal','2026-12-18','Dia letivo',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Data de término do efetivo trabalho educativo/escolar prevista pela Secretaria Municipal de Educação para o ano letivo de 2026. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-termino-letivo',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-termino-letivo' FROM events
WHERE id='public-rede-2026-termino-letivo' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-inicio-recesso','Início do recesso escolar — de 19 a 31/12','2026-12-19','Recesso',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Início do período de recesso escolar de 19 a 31 de dezembro de 2026, conforme o calendário da rede municipal. Este registro marca o início do período. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-inicio-recesso',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-inicio-recesso' FROM events
WHERE id='public-rede-2026-inicio-recesso' AND changes()>0;

INSERT OR IGNORE INTO events(id,title,date,type,creator,visibility,formation,start,end,location,details)
SELECT 'public-rede-2026-fim-recesso','Fim do recesso de 19 a 31/12/2026 — calendário da rede','2026-12-31','Recesso',email,'public',0,'','','SME Florianópolis · Calendário da rede municipal 2026','Último dia do período de recesso escolar de 19 a 31 de dezembro previsto no calendário de 2026. Esta data não informa a volta às aulas de 2027. Fonte oficial: https://www.pmf.sc.gov.br/entidades/educacao/index.php?cms=calendario+letivo+de+2026&menu=0'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-rede-2026-fim-recesso',creator,'SEED_PUBLIC_CONTENT','/api/events/public-rede-2026-fim-recesso' FROM events
WHERE id='public-rede-2026-fim-recesso' AND changes()>0;

-- Useful current guidance; the highlight deadline is not an enrollment deadline.
INSERT OR IGNORE INTO notices(id,title,body,date,published,creator,expires_on,featured,highlight_from,highlight_until)
SELECT 'public-matriculas-orientacoes-2026-10','Matrículas e transferências: orientações da rede','A página oficial da Prefeitura reúne orientações e documentos para matrículas e transferências no Ensino Fundamental, incluindo os documentos de 2027. Consulte os links na seção Documentos úteis e confirme com a secretaria os procedimentos para o seu atendimento.','2026-10-22',1,email,'2026-12-31',1,'2026-10-22','2026-10-31'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1);
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-public-matriculas-orientacoes-2026-10',creator,'SEED_PUBLIC_CONTENT','/api/notices/public-matriculas-orientacoes-2026-10' FROM notices
WHERE id='public-matriculas-orientacoes-2026-10' AND changes()>0;

-- Complete only empty institutional contact fields already used by the public page.
-- Replace only the neutral default introduction; preserve customized text, opening hours and WhatsApp.
UPDATE school_profile SET
 introduction=CASE WHEN trim(introduction) IN ('','Informações e serviços para estudantes, famílias e comunidade escolar.') THEN 'Somos uma escola da rede municipal de Florianópolis, no bairro Saco Grande. Atendemos estudantes do 1º ao 9º ano do Ensino Fundamental e compartilhamos com as famílias a caminhada de aprender e conviver.' ELSE introduction END,
 address=CASE WHEN trim(address)='' THEN 'Rodovia Virgílio Várzea, 1264 · Saco Grande' || char(10) || 'Florianópolis/SC · CEP 88032-001' ELSE address END,
 phone=CASE WHEN trim(phone)='' THEN '(48) 3238-2299' ELSE phone END,
 email=CASE WHEN trim(email)='' THEN 'ebm.donicia@sme.pmf.sc.gov.br' ELSE email END,
 version=version+1
WHERE id=1 AND (trim(introduction) IN ('','Informações e serviços para estudantes, famílias e comunidade escolar.') OR trim(address)='' OR trim(phone)='' OR trim(email)='')
AND EXISTS(SELECT 1 FROM users WHERE active=1 AND role IN ('direction','supervision','guidance'));
INSERT OR IGNORE INTO audit(id,actor,action,target)
SELECT 'seed-0018-school-profile',email,'SEED_PUBLIC_CONTACTS','/api/school'
FROM (SELECT email FROM users WHERE active=1 AND role IN ('direction','supervision','guidance') ORDER BY CASE role WHEN 'direction' THEN 0 WHEN 'supervision' THEN 1 ELSE 2 END,email LIMIT 1) WHERE changes()>0;
