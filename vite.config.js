import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {stripAnswerKeys} from './scripts/strip-answer-keys.mjs';
// Three pages: the home portal, the 2D game and the teacher/admin panel. The old 3D Doom prototype is gone (audit №14).
// __TJ_QA_UNLOCK__: every epoch open on the dev server only (src/rpg/levels.js); TJ_QA_UNLOCK=1 opens them in a build too.
// stripAnswerKeys: a production build ships no trial answer keys; the server checks every choice (migration 021).
export default defineConfig(({command})=>({
  define:{__TJ_QA_UNLOCK__:JSON.stringify(command==='serve'||process.env.TJ_QA_UNLOCK==='1')},
  build:{rollupOptions:{input:{home:fileURLToPath(new URL('./index.html',import.meta.url)),rpg:fileURLToPath(new URL('./rpg.html',import.meta.url)),admin:fileURLToPath(new URL('./admin.html',import.meta.url))}}},
  plugins:[
    {name:'admin-path',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/admin'||req.url==='/admin/')req.url='/admin.html';next();});}},
    ...(command==='build'&&process.env.TJ_KEEP_KEYS!=='1'?[stripAnswerKeys()]:[]),
  ],
}));
