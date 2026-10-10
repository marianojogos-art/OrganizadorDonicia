import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,BackHandler,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import injectedSge from './src/injected-runtime.js';
import injectedOrganizer from './src/injected-organizer.js';
import {SGE_HOME,SGE_CLASSES,allowedNavigation,validBridgeEvent,validBridgePage} from './src/connection.js';
import {ORGANIZER,organizerNavigation,organizerSender,MobileBridge} from './src/mobile-bridge.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function Button({title,onPress,disabled}){return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>}
export default function App(){return <SafeAreaProvider><OrganizerApp/></SafeAreaProvider>}
function OrganizerApp(){
 const organizer=useRef(null),sge=useRef(null),pending=useRef(new Map()),navigation=useRef(null),sequence=useRef(0),bridge=useRef(null),loadingSge=useRef(false);
 const [screen,setScreen]=useState('organizer'),[sgeOpened,setSgeOpened]=useState(false),[siteLoading,setSiteLoading]=useState(true),[siteError,setSiteError]=useState(''),[status,setStatus]=useState(''),[canGoBack,setCanGoBack]=useState(false),[sgeBack,setSgeBack]=useState(false),[sgeLoading,setSgeLoading]=useState(false);
 function reply(message){organizer.current?.injectJavaScript('window.__doniciaNativeReply?.('+JSON.stringify(message)+');true;')}
 function rpc(kind,action){return new Promise((resolve,reject)=>{
  if(!sge.current)return reject(Error('Toque em SGE no aplicativo, entre e abra os planejamentos de turmas.'));
  const id='native-'+(++sequence.current),timer=setTimeout(()=>{pending.current.delete(id);reject(Error('O SGE não respondeu. Verifique se o login está aberto no aplicativo.'))},10000);
  pending.current.set(id,{resolve,reject,timer});sge.current.injectJavaScript(injectedSge+'\nwindow.__doniciaMobile?.request('+JSON.stringify({id,kind,action})+');true;');
 })}
 async function snapshot(){
  const end=Date.now()+30000;while(loadingSge.current&&Date.now()<end)await delay(200);
  if(loadingSge.current)throw Error('O SGE demorou para carregar.');return rpc('snapshot');
 }
 function navigate(url){return new Promise((resolve,reject)=>{
  if(!allowedNavigation(url)||!sge.current)return reject(Error('Endereço do SGE inválido ou conexão ainda não aberta.'));
  const timer=setTimeout(()=>{navigation.current=null;reject(Error('O SGE demorou para carregar.'))},30000);
  navigation.current={resolve,reject,timer};sge.current.injectJavaScript('window.location.assign('+JSON.stringify(url)+');true;');
 }).then(snapshot)}
 async function move(action){
  const before=JSON.stringify(await snapshot());await rpc('open',action);const end=Date.now()+30000;
  while(Date.now()<end){await delay(250);const page=await snapshot();if(JSON.stringify(page)!==before)return page}
  throw Error('O SGE não concluiu a navegação. Abra a conexão SGE e confira sua sessão.');
 }
 async function openSge(url){
  if(url&&!allowedNavigation(url))return;
  setSgeOpened(true);setScreen('sge');
  if(url){for(let i=0;i<40&&!sge.current;i++)await delay(50);if(sge.current)await navigate(url).catch(e=>Alert.alert('SGE',e.message))}
 }
 if(!bridge.current)bridge.current=new MobileBridge({snapshot,navigate,move},{reply,openSge,status:setStatus});
 useEffect(()=>()=>{for(const p of pending.current.values()){clearTimeout(p.timer);p.reject(Error('Aplicativo encerrado.'))}if(navigation.current){clearTimeout(navigation.current.timer);navigation.current.reject(Error('Aplicativo encerrado.'))}},[]);
 useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(screen==='sge'){if(sgeBack)sge.current?.goBack();else setScreen('organizer');return true}if(canGoBack){organizer.current?.goBack();return true}return false});return ()=>listener.remove()},[screen,sgeBack,canGoBack]);
 function siteMessage(event){
  if(!organizerSender(event.nativeEvent.url))return;
  try{if(event.nativeEvent.data.length>1_000_000)return;const message=JSON.parse(event.nativeEvent.data);bridge.current.handle(message,event.nativeEvent.url).catch(()=>reply({channel:'donicia-sge-response',id:message.id,error:'Não foi possível conectar ao SGE.'}))}catch{}
 }
 function sgeMessage(event){
  if(!validBridgeEvent(event.nativeEvent))return;
  let message;try{if(event.nativeEvent.data.length>2_000_000)return;message=JSON.parse(event.nativeEvent.data)}catch{return}
  if(message.channel!=='donicia-mobile-sge'||typeof message.id!=='string'||!validBridgePage(message.pageUrl))return;
  const request=pending.current.get(message.id);if(!request)return;clearTimeout(request.timer);pending.current.delete(message.id);if(message.error)request.reject(Error(message.error));else request.resolve(message.data);
 }
 function sgeLoadEnd(){loadingSge.current=false;setSgeLoading(false);if(navigation.current){clearTimeout(navigation.current.timer);navigation.current.resolve();navigation.current=null}}
 function sgeError(){sgeLoadEnd();setStatus('Não foi possível carregar o SGE. Verifique sua conexão.');for(const p of pending.current.values()){clearTimeout(p.timer);p.reject(Error('Falha ao carregar o SGE.'))}pending.current.clear()}
 async function finishSge(){try{const page=await snapshot();if(page.type==='classes'){bridge.current.directoryUrl=page.sourceUrl;setScreen('organizer');setStatus('');Alert.alert('SGE conectado','Na Supervisão, toque em Consultar turmas no SGE.')}else Alert.alert('Abrir planejamentos','No SGE, abra a lista de turmas dos planejamentos antes de voltar ao Organizador.')}catch(e){Alert.alert('SGE',e.message)}}
 function openLink(url){if(allowedNavigation(url)&&url!=='about:blank'){openSge(url);return}if(organizerNavigation(url)){organizer.current?.injectJavaScript('window.location.assign('+JSON.stringify(url)+');true;');return}try{const u=new URL(url);if(['https:','http:','mailto:','tel:'].includes(u.protocol))Linking.openURL(url).catch(()=>Alert.alert('Abrir link','Não foi possível abrir este endereço.'))}catch{}}
 return <SafeAreaView style={styles.root}>
  {!!status&&<View style={styles.status}><Text accessibilityLiveRegion="polite" style={styles.statusText}>{status}{bridge.current.running?' · Mantenha o aplicativo aberto.':''}</Text></View>}
  <View style={[styles.browser,screen!=='organizer'&&styles.hidden]}><WebView ref={organizer} source={{uri:ORGANIZER}} style={styles.web} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled originWhitelist={['https://*']} setSupportMultipleWindows onOpenWindow={e=>openLink(e.nativeEvent.targetUrl)} injectedJavaScriptBeforeContentLoaded={injectedOrganizer} injectedJavaScript={injectedOrganizer} onMessage={siteMessage} onShouldStartLoadWithRequest={request=>{if(organizerNavigation(request.url))return true;openLink(request.url);return false}} onNavigationStateChange={state=>setCanGoBack(state.canGoBack)} onLoadStart={()=>{setSiteLoading(true);setSiteError('')}} onLoadEnd={()=>{setSiteLoading(false);organizer.current?.injectJavaScript(injectedOrganizer)}} onError={()=>{setSiteLoading(false);setSiteError('Não foi possível abrir o Organizador. Verifique a internet e toque em Recarregar.')}} onHttpError={e=>{if(e.nativeEvent.statusCode>=500)setSiteError('O Organizador está indisponível no momento. Tente recarregar.')}} onContentProcessDidTerminate={()=>organizer.current?.reload()}/></View>
  {sgeOpened&&<View style={[styles.browser,screen!=='sge'&&styles.hidden]}><View style={styles.sgeHeader}><Text style={styles.heading}>Conexão SGE</Text><Text style={styles.note}>Entre no SGE e abra os planejamentos de turmas.</Text><View style={styles.row}><Button title="Lista de turmas" disabled={sgeLoading||bridge.current.running} onPress={()=>navigate(SGE_CLASSES).catch(e=>Alert.alert('SGE',e.message))}/><Button title="Concluir conexão" disabled={sgeLoading||bridge.current.running} onPress={finishSge}/></View></View><WebView ref={sge} source={{uri:SGE_HOME}} style={styles.web} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled originWhitelist={['https://*']} setSupportMultipleWindows={false} injectedJavaScript={injectedSge} onMessage={sgeMessage} onShouldStartLoadWithRequest={request=>{if(allowedNavigation(request.url))return true;setStatus('O SGE tentou abrir um domínio diferente. Verifique o endereço antes de continuar.');return false}} onNavigationStateChange={state=>setSgeBack(state.canGoBack)} onLoadStart={()=>{loadingSge.current=true;setSgeLoading(true)}} onLoadEnd={sgeLoadEnd} onError={sgeError} onContentProcessDidTerminate={()=>{sge.current?.reload();setStatus('A conexão SGE foi reiniciada. Verifique sua sessão.')}}/></View>}
  {!!siteError&&screen==='organizer'&&<View style={styles.error}><Text style={styles.errorText}>{siteError}</Text></View>}
  {siteLoading&&screen==='organizer'&&<View style={styles.loading}><ActivityIndicator color="#16476c"/><Text style={styles.note}>Abrindo Organizador…</Text></View>}
  <View style={styles.toolbar}><Button title="Organizador" onPress={()=>setScreen('organizer')}/><Button title="SGE" disabled={bridge.current.running} onPress={()=>openSge()}/><Button title="Voltar" disabled={screen==='sge'?!sgeBack:!canGoBack} onPress={()=>screen==='sge'?sge.current?.goBack():organizer.current?.goBack()}/><Button title="Recarregar" disabled={bridge.current.running} onPress={()=>screen==='sge'?sge.current?.reload():organizer.current?.reload()}/></View>
 </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#f2f6fa'},browser:{flex:1},hidden:{position:'absolute',top:-10000,left:-10000,width:350,height:600},web:{flex:1},toolbar:{flexDirection:'row',justifyContent:'space-around',gap:5,padding:9,borderTopWidth:1,borderColor:'#dbe5ef',backgroundColor:'#fff'},button:{backgroundColor:'#eaf1f7',borderRadius:9,paddingVertical:12,paddingHorizontal:10},buttonText:{fontSize:12,color:'#16476c',fontWeight:'600'},disabled:{opacity:0.4},sgeHeader:{padding:13,gap:8,backgroundColor:'#edf4fa'},heading:{fontSize:18,color:'#16476c',fontWeight:'700'},note:{fontSize:12,color:'#526e84'},row:{flexDirection:'row',gap:10},status:{padding:9,backgroundColor:'#e1eee6'},statusText:{fontSize:12,color:'#174632'},error:{padding:14,backgroundColor:'#fff0ed'},errorText:{color:'#8a2d25',fontSize:13},loading:{position:'absolute',top:20,right:15,padding:12,gap:5,borderRadius:10,backgroundColor:'#fff',elevation:3}});
