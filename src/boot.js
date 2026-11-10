const root=document.querySelector('#app');
async function boot(){
 try{
  if(!window.WebAssembly||!window.fetch||!window.PointerEvent||!globalThis.crypto?.getRandomValues||!window.structuredClone||!document.createElement('canvas').getContext('2d')){
   root.textContent='Бұл браузер ойынға қажетті мүмкіндіктерді қолдамайды. Браузерді жаңартып, ойынды HTTPS арқылы ашыңыз.';return;
  }
  await import('./main.js');
 }catch{
  root.textContent='Ойын ашылмады. Байланыс пен браузердің сақтау баптауларын тексеріңіз. ';
  const retry=document.createElement('button');retry.textContent='Қайта жүктеу';retry.onclick=()=>location.reload();root.append(retry);
 }
}
boot();
