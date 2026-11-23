import {defineConfig} from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Emscripten is already compiled; Vite must not transform its runtime loader.
// __TJ_QA_UNLOCK__: every epoch open on the dev server only (src/rpg/levels.js); TJ_QA_UNLOCK=1 opens them in a build too.
export default defineConfig(({command})=>({define:{__TJ_QA_UNLOCK__:JSON.stringify(command==='serve'||process.env.TJ_QA_UNLOCK==='1')},build:{rollupOptions:{input:{legacy:fileURLToPath(new URL('./index.html',import.meta.url)),rpg:fileURLToPath(new URL('./rpg.html',import.meta.url)),admin:fileURLToPath(new URL('./admin.html',import.meta.url))}}},plugins:[{name:'doom-runtime',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(req.url==='/admin'||req.url==='/admin/'){req.url='/admin.html';return next();}
 if(req.url?.split('?')[0]!=='/engine/doom.js')return next();
 try{res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('./public/engine/doom.js',import.meta.url)));}catch(e){next(e);}
});}}]}));
