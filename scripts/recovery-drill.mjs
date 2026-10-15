// Isolated recovery rehearsal: never accepts an existing database or remote target.
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdtemp,readdir,readFile,rm,stat,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

if(process.argv.length!==2)throw new Error('Este ensaio não aceita banco, caminho ou destino: usa somente arquivos temporários próprios e dados fictícios.');
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
function open(path){const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');return db}
function snapshot(db){
 const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 const tables=schema.filter(row=>row.type==='table').map(row=>row.name).sort();
 const rows=Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM '+quote(table)).all().map(row=>JSON.stringify(row)).sort()]));
 return {schema,rows};
}
function integrity(db){
 assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
}
function seedLegacy(db){
 // Seed before the users-table replacement in migration 0010, using its real legacy schema.
 db.exec(`
  INSERT INTO users(email,name,role) VALUES('direction@example.invalid','Direção fictícia','direction'),('teacher@example.invalid','Docente fictícia','teacher');
  INSERT INTO auxiliaries(id,name,active) VALUES('drill-active','Auxiliar fictícia',1),('drill-inactive','Auxiliar inativa fictícia',0);
  INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible,class,subject,version,created_at) VALUES
   ('drill-booking-1','Biblioteca','2099-10-15','08:00','09:00','teacher@example.invalid','Ensaio fictício','Docente fictícia','61 fictícia','Leitura',4,'2099-10-15 07:00:00'),
   ('drill-booking-2','Biblioteca','2099-10-15','10:00','11:00','teacher@example.invalid','Ensaio fictício 2','Docente fictícia','62 fictícia','Leitura',2,'2099-10-15 07:00:00');
  INSERT INTO fixed_occupancy(id,space,weekday,start,end,from_date,to_date,purpose,creator,class,subject,responsible)
   VALUES('drill-fixed','Laboratório de ciências',CAST(strftime('%w','2099-10-15') AS INTEGER),'10:00','11:00','2099-10-01','2099-10-31','Ocupação fictícia','direction@example.invalid','61 fictícia','Ciências','Direção fictícia');
  INSERT INTO tasks(id,title,owner,due,status,restricted,creator,version,created_at)
   VALUES('drill-task','Tarefa fictícia restrita','teacher@example.invalid','2099-10-16','Pendente',1,'direction@example.invalid',7,'2099-10-15 07:00:00');
  INSERT INTO substitution_absences(id,teacher,start_date,total_days,source_version,creator,created_at)
   VALUES('drill-absence','Docente fictícia','2099-10-15',3,'fixture-v1','direction@example.invalid','2099-10-15 07:00:00');
  INSERT INTO substitutions(id,date,week,start,end,class,teacher,auxiliary,creator,absence_id,subject,completed,version) VALUES
   ('drill-sub-1','2099-10-15','2099-10-12','08:00','08:45','61 fictícia','Docente fictícia','drill-active','direction@example.invalid','drill-absence','Ciências',0,3),
   ('drill-sub-2','2099-10-15','2099-10-12','09:00','09:45','62 fictícia','Docente fictícia','drill-active','direction@example.invalid','drill-absence','Ciências',1,5);
  INSERT INTO audit(id,actor,action,target,created_at) VALUES('drill-audit','direction@example.invalid','POST','/api/tasks','2099-10-15 07:00:00');
  INSERT INTO teacher_directory(id,names,source_version,fetched_at,schedule)
   VALUES(1,'["Docente fictícia"]','fixture-v1','2099-10-15T07:00:00Z','{}');
 `);
}
function assertLinks(db){
 const task=db.prepare("SELECT t.*,u.name AS owner_name,c.name AS creator_name FROM tasks t JOIN users u ON u.email=t.owner JOIN users c ON c.email=t.creator WHERE t.id='drill-task'").get();
 assert.equal(task.owner_name,'Docente fictícia');assert.equal(task.creator_name,'Direção fictícia');assert.equal(task.restricted,1);assert.equal(task.version,7);assert.equal(task.verifier,'direction@example.invalid');
 const links=db.prepare("SELECT s.id,s.completed,s.version,a.name AS auxiliary_name,n.id AS absence_id,u.name AS creator_name FROM substitutions s JOIN auxiliaries a ON a.id=s.auxiliary JOIN substitution_absences n ON n.id=s.absence_id JOIN users u ON u.email=s.creator ORDER BY s.id").all();
 assert.equal(links.length,2);assert.equal(links[0].auxiliary_name,'Auxiliar fictícia');assert.equal(links[0].absence_id,'drill-absence');assert.equal(links[0].version,3);assert.equal(links[1].completed,1);assert.equal(links[1].version,5);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservations r JOIN users u ON u.email=r.owner WHERE u.email='teacher@example.invalid' AND r.status='Aprovada'").get().n,2);
 assert.equal(db.prepare("SELECT actor FROM audit WHERE id='drill-audit'").get().actor,'direction@example.invalid');
}
function exerciseConstraints(db){
 const passed=[];
 const probe=(name,fn)=>{db.exec('SAVEPOINT recovery_probe');try{fn();passed.push(name)}finally{db.exec('ROLLBACK TO recovery_probe; RELEASE recovery_probe')}};
 const booking=(id='probe',status='Aprovada',space='Biblioteca',start='08:30',end='09:30')=>db.prepare('INSERT INTO reservations(id,space,date,start,end,owner,purpose,status) VALUES(?,?,?,?,?,?,?,?)').run(id,space,'2099-10-15',start,end,'teacher@example.invalid','Somente teste fictício',status);
 const substitution=(id='probe',className='63 fictícia',auxiliary='drill-active',start='08:15',end='08:30',absence='drill-absence')=>db.prepare('INSERT INTO substitutions(id,date,week,start,end,class,teacher,auxiliary,creator,absence_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'2099-10-15','2099-10-12',start,end,className,'Docente fictícia',auxiliary,'direction@example.invalid',absence);
 probe('reservation_insert_overlap',()=>assert.throws(()=>booking(),/reservation_conflict/));
 probe('reservation_update_overlap',()=>assert.throws(()=>db.exec("UPDATE reservations SET start='08:30',end='09:30' WHERE id='drill-booking-2'"),/reservation_conflict/));
 probe('pending_request_allowed_but_conflicting_approval_blocked',()=>{booking('probe','Pendente');assert.throws(()=>db.exec("UPDATE reservations SET status='Aprovada' WHERE id='probe'"),/reservation_conflict/);assert.equal(db.prepare("SELECT status FROM reservations WHERE id='probe'").get().status,'Pendente')});
 probe('reservation_against_fixed_occupancy',()=>assert.throws(()=>booking('probe','Aprovada','Laboratório de ciências','10:15','10:45'),/reservation_conflict/));
 probe('fixed_occupancy_against_reservation',()=>assert.throws(()=>db.exec("INSERT INTO fixed_occupancy(id,space,weekday,start,end,from_date,to_date,purpose,creator) VALUES('probe','Biblioteca',CAST(strftime('%w','2099-10-15') AS INTEGER),'08:30','09:30','2099-10-15','2099-10-15','Fictício','direction@example.invalid')"),/reservation_conflict/));
 probe('substitution_class_overlap',()=>assert.throws(()=>substitution('probe','61 fictícia',null),/class_conflict/));
 probe('substitution_auxiliary_overlap',()=>assert.throws(()=>substitution(),/auxiliary_conflict/));
 probe('substitution_inactive_auxiliary',()=>assert.throws(()=>substitution('probe','63 fictícia','drill-inactive'),/auxiliary_inactive/));
 probe('substitution_weekly_limit',()=>{db.exec("UPDATE settings SET value=2 WHERE key='auxiliary_weekly_limit'");assert.throws(()=>substitution('probe','63 fictícia','drill-active','11:00','11:45'),/auxiliary_limit/)});
 probe('task_owner_foreign_key',()=>assert.throws(()=>db.exec("INSERT INTO tasks(id,title,owner,due,creator) VALUES('probe','Fictício','missing@example.invalid','2099-10-16','direction@example.invalid')"),/FOREIGN KEY constraint failed/));
 probe('substitution_absence_foreign_key',()=>assert.throws(()=>substitution('probe','63 fictícia',null,'11:00','11:45','missing-absence'),/FOREIGN KEY constraint failed/));
 probe('task_status_check',()=>assert.throws(()=>db.exec("UPDATE tasks SET status='Inválido' WHERE id='drill-task'"),/CHECK constraint failed/));
 probe('task_optimistic_revision',()=>{const update=db.prepare("UPDATE tasks SET title='Nova versão fictícia',version=version+1 WHERE id='drill-task' AND version=?");assert.equal(update.run(6).changes,0);assert.equal(update.run(7).changes,1);assert.equal(update.run(7).changes,0)});
 probe('atomic_rollback_after_conflict',()=>{
  db.exec('SAVEPOINT atomic_batch');db.exec("UPDATE tasks SET title='Mudança descartável' WHERE id='drill-task'");assert.throws(()=>booking(),/reservation_conflict/);
  db.exec('ROLLBACK TO atomic_batch; RELEASE atomic_batch');assert.equal(db.prepare("SELECT title FROM tasks WHERE id='drill-task'").get().title,'Tarefa fictícia restrita');
 });
 return passed;
}
async function drill(){
 const directory=await mkdtemp(join(tmpdir(),'donicia-recovery-drill-')),handles=new Set();
 const connect=path=>{const db=open(path);handles.add(db);return db};
 const close=db=>{db.close();handles.delete(db)};
 try{
  const sourcePath=join(directory,'disposable-source.sqlite'),backupPath=join(directory,'synthetic-backup.sqlite'),restoredPath=join(directory,'restored.sqlite');
  const source=connect(sourcePath),migrationRoot=new URL('../migrations/',import.meta.url),migrations=[];
  for(const name of (await readdir(migrationRoot)).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
   const sql=await readFile(new URL(name,migrationRoot),'utf8');source.exec('BEGIN IMMEDIATE');
   try{source.exec(sql);source.exec('COMMIT')}catch(error){source.exec('ROLLBACK');throw new Error('Falha na migração '+name,{cause:error})}
   migrations.push({name,sha256:hash(sql)});if(name==='0009_personal_notes.sql')seedLegacy(source);
  }
  assert.ok(migrations.some(migration=>migration.name==='0009_personal_notes.sql'),'O marco de preparação dos dados legados precisa ser revisto.');
  // Replace public migration defaults too: no institutional contacts in the fixture.
  source.exec("UPDATE school_profile SET name='Escola fictícia de recuperação',introduction='Ensaio isolado',address='',phone='',email='school@example.invalid',hours='',whatsapp_secretaria='',whatsapp_orientacao=''; UPDATE tasks SET verifier='direction@example.invalid' WHERE id='drill-task'");
  integrity(source);assertLinks(source);const baseline=snapshot(source),baselineHash=hash(JSON.stringify(baseline));
  const backupStart=performance.now();await backup(source,backupPath);const backupMs=performance.now()-backupStart,backupBytes=(await stat(backupPath)).size,backupHash=hash(await readFile(backupPath));
  // Deliberately write after the recovery point to prove the backup's real boundary.
  source.exec("INSERT INTO tasks(id,title,owner,due,creator,created_at) VALUES('drill-after-backup','Registro fictício posterior ao backup','teacher@example.invalid','2099-10-16','direction@example.invalid','2099-10-15 07:01:00')");
  assert.equal(source.prepare("SELECT COUNT(*) AS n FROM tasks").get().n,2);
  close(source);
  // Only a file created above is removed. No path can be supplied by the caller.
  await unlink(sourcePath);const lost=connect(sourcePath);assert.equal(lost.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='table'").get().n,0);close(lost);
  const copy=connect(backupPath);integrity(copy);assert.equal(hash(JSON.stringify(snapshot(copy))),baselineHash);
  const restoreStart=performance.now();await backup(copy,restoredPath);const restoreMs=performance.now()-restoreStart;close(copy);
  const restored=connect(restoredPath);integrity(restored);assert.deepEqual(snapshot(restored),baseline);assertLinks(restored);
  assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id='drill-after-backup'").get().n,0,'A restauração deve corresponder ao backup, sem fingir recuperar escrita posterior.');
  const constraintChecks=exerciseConstraints(restored);integrity(restored);assert.deepEqual(snapshot(restored),baseline,'Os testes de conflito devem desfazer suas próprias alterações.');
  const counts=Object.fromEntries(Object.entries(baseline.rows).map(([table,rows])=>[table,rows.length]));
  return {result:'passed',environment:'cloud executor; isolated node:sqlite files',node:process.version,sqlite:restored.prepare('SELECT sqlite_version() AS version').get().version,migrationCount:migrations.length,migrations,schemaObjects:baseline.schema.length,tableCount:Object.keys(counts).length,rowCounts:counts,backup:{bytes:backupBytes,sha256:backupHash,milliseconds:Number(backupMs.toFixed(3))},restore:{milliseconds:Number(restoreMs.toFixed(3)),schemaAndRowsSha256:baselineHash,exactSchemaAndRowsMatch:true,integrityCheck:'ok',foreignKeyViolations:0,originalDisposableFileLost:true,postBackupWriteRecovered:false},constraintChecks,temporaryArtifactsRemoved:true,remoteD1Tested:false};
 }finally{for(const db of handles)db.close();await rm(directory,{recursive:true,force:true})}
}
console.log(JSON.stringify(await drill(),null,2));
