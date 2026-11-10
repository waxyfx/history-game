import sizes from './resource-sizes.json';
export async function loadResources(report){
 const zipped=typeof DecompressionStream==='function'&&typeof TransformStream==='function';
 const names=Object.keys(sizes);
 const total=names.reduce((sum,n)=>sum+sizes[n][zipped?'compressed':'raw'],0);
 let received=0;
 const update=count=>{received+=count;report(Math.min(99,Math.floor(100*received/total)));};
 const controller=new AbortController();
 try{
  const entries=await Promise.all(names.map(async name=>{
   const meta=sizes[name];
   const url='/engine/'+name+(zipped?'.pack':'')+'?v='+meta.compressed;
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok)throw Error('Ойын файлы жүктелмеді. Байланысты тексеріп, қайта жүктеңіз.');
   let bytes;
   if(response.body && typeof TransformStream==='function'){
    let stream=response.body.pipeThrough(new TransformStream({transform(chunk,sink){update(chunk.byteLength);sink.enqueue(chunk);}}));
    if(zipped)stream=stream.pipeThrough(new DecompressionStream('gzip'));
    bytes=await new Response(stream).arrayBuffer();
   }else{
    bytes=await response.arrayBuffer();update(bytes.byteLength);
    if(zipped)bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   }
   if(bytes.byteLength!==meta.raw)throw Error('Ойын файлы толық жүктелмеді.');
   return [name,new Uint8Array(bytes)];
  }));
  return Object.fromEntries(entries);
 }catch(error){controller.abort();throw error;}
}
