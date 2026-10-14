import {readLimitedBody,XeroxInputError} from './xerox.mjs';
export const METRIC_SECTIONS=Object.freeze(['home','escola','avisos','calendario','contatos','redes','entrada_equipe','whatsapp_secretaria','whatsapp_orientacao']);
export const METRIC_EVENTS=Object.freeze(['page_view','section_click','whatsapp_click']);
export const METRIC_LIMITS=Object.freeze({sessionEventsPerDay:100,sessionViewsPerDay:20,eventSectionIntervalMs:2000,globalEventsPerDay:20000,identifierRetentionHours:48,aggregateRetentionDays:90});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayOf=ms=>new Date(ms).toISOString().slice(0,10),dayMs=86400000;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
const accepted=()=>json({accepted:true},202);
const zeros=()=>({views:0,estimatedVisits:0,sectionClicks:0,whatsappClicks:0});
const normalized=row=>({views:Number(row.views)||0,estimatedVisits:Number(row.estimated_visits)||0,sectionClicks:Number(row.section_clicks)||0,whatsappClicks:Number(row.whatsapp_clicks)||0});
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')}
function eventAllowed(event,section){return event==='page_view'?section==='home':event==='section_click'?METRIC_SECTIONS.slice(1,7).includes(section):event==='whatsapp_click'&&METRIC_SECTIONS.slice(7).includes(section)}

// Called only for the public portal. The random client session is scoped to tab/day.
// No raw identifier or request metadata is retained; common bot UAs are checked in memory.
// Cleanup is opportunistic on ingestion, not an automatic cron. If traffic stops,
// expired rows remain until the next ingestion or an authorized maintenance run.
export async function ingestMetrics(request,DB){
 if(new URL(request.url).pathname!=='/public/metrics')return json({error:'Rota não encontrada'},404);
 if(request.method==='HEAD'){try{await DB.prepare('SELECT day FROM site_metrics_daily LIMIT 1').first();return new Response(null,{status:204,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}})}}
 if(request.method!=='POST')return json({error:'Método não permitido'},405,{'Allow':'POST, HEAD'});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem não permitida'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'Envie JSON'},415);
 let data;
 try{data=JSON.parse(await readLimitedBody(request,2048))}catch(error){return json({error:error instanceof XeroxInputError?error.message:'JSON inválido'},error instanceof XeroxInputError?error.status:400)}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==4||!['eventId','sessionId','event','section'].every(key=>Object.hasOwn(data,key))||!uuid.test(data.eventId)||!uuid.test(data.sessionId)||!eventAllowed(data.event,data.section))return json({error:'Evento inválido'},400);
 const bot=/(?:bot\b|crawler|spider|headless|slurp|facebookexternalhit|bingpreview|lighthouse|pagespeed|curl\/|wget\/)/i.test(request.headers.get('User-Agent')||'');
 if(bot)return accepted();
 const now=Date.now(),day=dayOf(now),oldestDay=dayOf(now-89*dayMs),cutoff=now-48*3600000;
 const [sessionHash,eventHash]=await Promise.all([hash(day+'|session|'+data.sessionId.toLowerCase()),hash(day+'|event|'+data.eventId.toLowerCase())]);
 try{
  // One transaction: prune, guarded/idempotent insert, aggregates via trigger, result.
  // INSERT OR IGNORE never runs the aggregate trigger twice for an event digest.
  const results=await DB.batch([
   DB.prepare('DELETE FROM site_metrics_events WHERE created_ms<?').bind(cutoff),
   DB.prepare('DELETE FROM site_metrics_sessions WHERE created_ms<?').bind(cutoff),
   DB.prepare('DELETE FROM site_metrics_sections WHERE day<?').bind(oldestDay),
   DB.prepare('DELETE FROM site_metrics_daily WHERE day<?').bind(oldestDay),
   DB.prepare('INSERT OR IGNORE INTO site_metrics_events(event_hash,day,session_hash,event,section,created_ms) VALUES(?,?,?,?,?,?)').bind(eventHash,day,sessionHash,data.event,data.section,now),
   DB.prepare('SELECT event_hash FROM site_metrics_events WHERE event_hash=?').bind(eventHash)
  ]);
  if(results.at(-1).results?.length)return accepted();
  return json({error:'Limite de métricas atingido. Tente mais tarde.'},429,{'Retry-After':'2'});
 }catch{return json({error:'Métricas temporariamente indisponíveis'},503)}
}
export async function readMetrics(request,DB,user){
 if(new URL(request.url).pathname!=='/api/site-metrics')return json({error:'Rota não encontrada'},404);
 if(!['direction','supervision','guidance'].includes(user?.role))return json({error:'Sem permissão'},403);
 if(request.method!=='GET')return json({error:'Método não permitido'},405,{'Allow':'GET'});
 const now=Date.now(),today=dayOf(now),params=new URL(request.url).searchParams,from=params.get('from')??dayOf(now-29*dayMs),to=params.get('to')??today;
 const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&dayOf(Date.parse(value))===value;
 const retained=dayOf(now-89*dayMs);
 if([...params.keys()].some(key=>!['from','to'].includes(key))||params.getAll('from').length>1||params.getAll('to').length>1||!valid(from)||!valid(to)||from>to||to>today||from<retained||Date.parse(to)-Date.parse(from)>89*dayMs)return json({error:'Use um intervalo UTC de até 90 dias dentro dos últimos 90 dias'},400);
 try{
  const [daily,sections]=await Promise.all([
   DB.prepare('SELECT day,views,estimated_visits,section_clicks,whatsapp_clicks FROM site_metrics_daily WHERE day BETWEEN ? AND ? ORDER BY day').bind(from,to).all(),
   DB.prepare('SELECT section,event,SUM(count) AS count FROM site_metrics_sections WHERE day BETWEEN ? AND ? GROUP BY section,event').bind(from,to).all()
  ]);
  const byDay=[],lookup=new Map(daily.results.map(row=>[row.day,normalized(row)])),totals=zeros();
  for(let ms=Date.parse(from);ms<=Date.parse(to);ms+=dayMs){const day=dayOf(ms),counts=lookup.get(day)??zeros();byDay.push({day,...counts});for(const key of Object.keys(totals))totals[key]+=counts[key]}
  const bySection=METRIC_SECTIONS.map(section=>({section,views:0,sectionClicks:0,whatsappClicks:0}));
  for(const row of sections.results){const item=bySection.find(item=>item.section===row.section),key={page_view:'views',section_click:'sectionClicks',whatsapp_click:'whatsappClicks'}[row.event];if(item&&key)item[key]+=Number(row.count)||0}
  return json({from,to,timezone:'UTC',totals,byDay,bySection,limits:METRIC_LIMITS,notice:'Visitas estimadas por aba e dia UTC; não representam pessoas únicas. Bots conhecidos são filtrados, mas outros podem entrar. Limites podem reduzir a contagem. Identificadores diários resumidos por SHA-256 ficam por até 48 horas de atividade; agregados por 90 dias. Limpeza oportunista na próxima coleta.'});
 }catch{return json({error:'Não foi possível consultar as métricas'},503)}
}
