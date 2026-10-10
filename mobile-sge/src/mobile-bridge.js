import {createSgeReader} from '../../src/sge-reader.mjs';
export const ORGANIZER='https://organizadordonicia.carijo.workers.dev';
export const ACCESS='https://tiny-dew-2c0d.cloudflareaccess.com';
export function organizerNavigation(value){try{const u=new URL(value);return !u.username&&!u.password&&[ORGANIZER,ACCESS].includes(u.origin)}catch{return false}}
export function organizerSender(value){try{const u=new URL(value);return !u.username&&!u.password&&u.origin===ORGANIZER}catch{return false}}
export class MobileBridge{
 constructor(transport,{reply,openSge=()=>{},status=()=>{}}){this.transport=transport;this.reply=reply;this.openSge=openSge;this.status=status;this.running=false;this.directoryUrl=null;this.reader=createSgeReader(transport)}
 async handle(message,sender){
  if(!organizerSender(sender)||message?.channel!=='donicia-native-organizer')return;
  if(message.command==='open-sge'){if(this.running){this.status('Aguarde a consulta atual antes de abrir outro planejamento.');return}await this.openSge(message.url);return}
  if(typeof message.id!=='string'||message.id.length>150)return;
  const response=data=>this.reply({channel:'donicia-sge-response',id:message.id,...data});
  if(message.command==='ping'){response({data:{version:'mobile-1.0.0',progress:true,selective:true,native:true}});return}
  if(!['directory','teachers','planning'].includes(message.command))return;
  if(this.running){response({error:'Já há uma consulta ao SGE em andamento. Aguarde.'});return}
  this.running=true;this.status('Consultando o SGE…');
  try{
   const progress=update=>{this.reply({channel:'donicia-sge-progress',id:message.id,progress:update});this.status(update.stage==='directory'?'Turmas · página '+update.current+' de '+update.total:update.name?'Consultando '+update.name:'Consultando o SGE…')};
   if(message.command==='directory'){
    const page=await this.transport.snapshot();
    if(page.type!=='classes'){if(this.directoryUrl)await this.transport.navigate(this.directoryUrl);else throw Error('Entre no SGE pelo botão do aplicativo e abra a lista de turmas dos planejamentos.')}
   }
   const data=message.command==='directory'?await this.reader.directory(progress):message.command==='teachers'?await this.reader.teachers(message.input):await this.reader.planning(message.input,progress);
   if(message.command==='directory')this.directoryUrl=data.sourceUrl;
   this.running=false;this.status('');response({data});
  }catch(e){this.running=false;this.status('');response({error:e.message});if(!this.directoryUrl&&message.command==='directory')await this.openSge()}
 }
}
