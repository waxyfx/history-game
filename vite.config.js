import {defineConfig} from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Emscripten is already compiled; Vite must not transform its runtime loader.
export default defineConfig({build:{rollupOptions:{input:{legacy:fileURLToPath(new URL('./index.html',import.meta.url)),rpg:fileURLToPath(new URL('./rpg.html',import.meta.url)),admin:fileURLToPath(new URL('./admin.html',import.meta.url))}}},plugins:[{name:'doom-runtime',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(req.url==='/admin'||req.url==='/admin/'){req.url='/admin.html';return next();}
 if(req.url?.split('?')[0]!=='/engine/doom.js')return next();
 try{res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('./public/engine/doom.js',import.meta.url)));}catch(e){next(e);}
});}}]});
