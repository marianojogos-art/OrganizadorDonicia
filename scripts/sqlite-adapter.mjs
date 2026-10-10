import {DatabaseSync} from 'node:sqlite';
export function sqlite(path=':memory:'){
 const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');let queue=Promise.resolve();
 return {exec:s=>db.exec(s),close:()=>db.close(),batch(statements){const result=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}});queue=result.catch(()=>{});return result},prepare(sql){let args=[];const statement=db.prepare(sql);return {bind(...a){args=a;return this},async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return statement.columns().length?{results:statement.all(...args)}:{meta:statement.run(...args)}}}}
 }
}
