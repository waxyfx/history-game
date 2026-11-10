import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db=url&&key?createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export async function rpc(name,args={}){if(!db)throw new Error('Онлайн режим әлі бапталмаған. Жаттығу режимін таңдаңыз.');const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message);return data;}
export async function login(){if(!db)throw new Error('Google арқылы кіру үшін серверді баптау қажет.');const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;}
