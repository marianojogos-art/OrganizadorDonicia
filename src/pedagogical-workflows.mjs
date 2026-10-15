// A returned request stays pending in the original schema, with an explicit review flag.
export const returnedStatus='Devolvida para ajustes';
export const projectReview=row=>row?.needs_adjustment?{...row,status:returnedStatus}:row;
export const validReason=value=>typeof value==='string'&&!!value.trim()&&value.length<=2000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function highlightFields(data,old={},defaultFeatured=false){
 const featured=data.featured??!!(old.featured??defaultFeatured),from=data.highlight_from??old.highlight_from??'',until=data.highlight_until??old.highlight_until??'';
 if(typeof featured!=='boolean'||from!==''&&!date(from)||until!==''&&!date(until)||from&&until&&until<from)throw new Error('Período do destaque inválido');
 return [Number(featured),from,until];
}
