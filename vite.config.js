import {defineConfig} from 'vite';
import {readFile} from 'node:fs/promises';
// Emscripten is already compiled; Vite must not transform its runtime loader.
export default defineConfig({plugins:[{name:'doom-runtime',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(req.url?.split('?')[0]!=='/engine/doom.js')return next();
 try{res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('./public/engine/doom.js',import.meta.url)));}catch(e){next(e);}
});}}]});
