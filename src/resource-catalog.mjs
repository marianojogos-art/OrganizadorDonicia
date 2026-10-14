// Links oficiais conferidos em 14/10/2026. Não armazena cópias dos documentos.
const portal='https://sites.google.com/sme.pmf.sc.gov.br/portaleducacional/forma%C3%A7%C3%A3o-continuada-ensino-fundamental';
export const resourceCategories=Object.freeze([
 Object.freeze({id:'bncc',label:'BNCC'}),
 Object.freeze({id:'matriz',label:'Matriz curricular da rede'}),
 Object.freeze({id:'documentos',label:'Documentos oficiais'})
]);
export const resourceCatalog=Object.freeze([
 {id:'bncc-oficial',category:'bncc',title:'BNCC — documento oficial do MEC',url:'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',source:'Ministério da Educação',description:'Referência nacional. Consulte a etapa e o componente curricular no documento oficial.'},
 {id:'matriz-rmef-iniciais-2026',category:'matriz',title:'Matriz de Referência Curricular 2026 — Anos Iniciais',url:'https://drive.google.com/file/d/1qt7I_c2jUtvWr7K18JewdeGjkznhd7lo/view',source:portal,description:'Documento da rede municipal vinculado pela SME. Não é uma matriz específica da escola.'},
 {id:'matriz-rmef-finais-2026',category:'matriz',title:'Matriz de Referência Curricular 2026 — Anos Finais',url:'https://drive.google.com/file/d/1P9EtOwcIOgAXlM0k1nsdfxHQL_CKADkB/view',source:portal,description:'Documento da rede municipal vinculado pela SME. Não é uma matriz específica da escola.'},
 {id:'referencial-digital-2026',category:'matriz',title:'Referencial Curricular de Educação Digital e Midiática 2026',url:'https://drive.google.com/file/d/1m2QQY6O0fLpbXnI4ZDdSeGEoRAH46sv9/view',source:portal,description:'Referencial da rede vinculado pela SME. O provedor pode solicitar login.'},
 {id:'politica-formacao-2026',category:'documentos',title:'Política de Formação da RMEF 2026',url:'https://drive.google.com/file/d/1kDiLZnUkUOxmtns-pC6Amvtxi08wgXYp/view',source:portal,description:'Documento oficial vinculado pela SME. O provedor pode solicitar login.'},
 {id:'portal-formacao-sme',category:'documentos',title:'Portal da SME — formação e referências curriculares',url:portal,source:'Secretaria Municipal de Educação de Florianópolis',description:'Confira versões, atualizações e condições de acesso na fonte oficial.'}
].map(item=>Object.freeze({...item,verifiedAt:'2026-10-14'})));
// Sem categoria retorna todo o catálogo; categoria desconhecida não amplia resultados.
export function getResourceCatalog(category){
 return category===undefined?resourceCatalog:resourceCatalog.filter(item=>item.category===category);
}
