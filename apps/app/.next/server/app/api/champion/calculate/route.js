(()=>{var e={};e.id=202,e.ids=[202],e.modules={3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10523:(e,t,r)=>{"use strict";r.d(t,{UU:()=>n});var s=r(98811);let a=null,o=()=>!1,n=()=>{if(a)return a;if(!o())return console.debug("서버 환경에서 Supabase 클라이언트 호출 - 제한된 기능"),{auth:{getSession:()=>({data:{session:null}}),getUser:()=>({data:{user:null}}),signOut:()=>Promise.resolve({error:null}),signInWithOAuth:()=>Promise.resolve({data:null,error:Error("서버 환경에서는 OAuth 불가")})},from:()=>({select:()=>({eq:()=>({single:()=>Promise.resolve({data:null,error:null}),data:[],error:null})})})};let e="https://izkumvvlkrkgiuuczffp.supabase.co",t="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6a3VtdnZsa3JrZ2l1dWN6ZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTI3NzksImV4cCI6MjA2MDk4ODc3OX0.pQH_znuBuBfLBJdnMagX4_HE37Z8uraCp1_MaJFtEfc";try{return a=(0,s.kT)(e,t,{auth:{autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,flowType:"pkce"},cookies:{get(e){if("undefined"!=typeof document){let t=`; ${document.cookie}`.split(`; ${e}=`);if(2===t.length)return t.pop()?.split(";").shift()}},set(e,t,r){if("undefined"!=typeof document){let s=`${e}=${t}`;r?.maxAge&&(s+=`; max-age=${r.maxAge}`),r?.path&&(s+=`; path=${r.path}`),r?.domain&&(s+=`; domain=${r.domain}`),r?.secure&&(s+="; secure"),r?.httpOnly&&(s+="; httponly"),r?.sameSite&&(s+=`; samesite=${r.sameSite}`),document.cookie=s}},remove(e,t){if("undefined"!=typeof document){let r=`${e}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;t?.path&&(r+=`; path=${t.path}`),t?.domain&&(r+=`; domain=${t.domain}`),document.cookie=r}}},global:{fetch:(...e)=>{let r=String(e[0]instanceof URL?e[0].toString():e[0]),s=["/meal_images","/profiles","/menu_item_ratings","/school_infos","/quiz","/comment_likes"].some(e=>r.includes(e)||r.includes("school_infos")||r.includes("/quiz"));if(r.includes("/rest/v1/")){let r=e[1]?.headers||{};e[1]={...e[1],headers:{...r,apikey:t,Authorization:`Bearer ${t}`,Accept:"application/json"}}}return!r.includes("/rest/v1/")||s||e[1]?.headers&&Object.entries(e[1]?.headers||{}).some(([e,t])=>"apikey"===e.toLowerCase()||"authorization"===e.toLowerCase())?r.includes("/comment_likes")?(e[1]||(e[1]={}),e[1].headers||(e[1].headers={}),e[1].headers.Accept="application/json",e[1].headers["Content-Type"]="application/json",fetch(...e).then(e=>200!==e.status?(console.debug(`comment_likes 요청 응답 코드 ${e.status} 수정 처리`),new Response(JSON.stringify({data:[]}),{status:200,headers:{"Content-Type":"application/json"}})):e).catch(e=>(console.debug("좋아요 요청 처리 오류 포착:",e),new Response(JSON.stringify({data:[]}),{status:200})))):fetch(...e).catch(e=>{if(404===e.status)return new Response(JSON.stringify({error:"Not found",quiet:!0}),{status:404});throw e}):(console.debug("권한 없는 Supabase REST API 요청 차단:",r),Promise.resolve(new Response(JSON.stringify({message:"No API key found in request",hint:"No 'apikey' request header or url param was found."}),{status:401})))}}})}catch(r){return console.debug("Supabase 클라이언트 초기화 중 오류 발생 (무시됨)"),a=(0,s.kT)(e,t)}}},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:e=>{"use strict";e.exports=require("punycode")},27910:e=>{"use strict";e.exports=require("stream")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},34631:e=>{"use strict";e.exports=require("tls")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:e=>{"use strict";e.exports=require("crypto")},55591:e=>{"use strict";e.exports=require("https")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:e=>{"use strict";e.exports=require("zlib")},78374:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>w,routeModule:()=>m,serverHooks:()=>y,workAsyncStorage:()=>h,workUnitAsyncStorage:()=>g});var s={};r.r(s),r.d(s,{GET:()=>_,POST:()=>d});var a=r(48106),o=r(48819),n=r(12050),c=r(4235),i=r(10523),l=r(84875);class u{getSupabaseClient(){try{return(0,l.U)()}catch(e){return console.log("서버 클라이언트 생성 실패, 기본 클라이언트 사용:",e),(0,i.UU)()}}get supabase(){return this.getSupabaseClient()}getWeekInfo(e){let t=e.getFullYear(),r=e.getMonth(),s=new Date(t,r,1),a=new Date(s),o=s.getDay();a.setDate(1+(0===o?1:(8-o)%7));let n=Math.floor(Math.floor((e.getTime()-a.getTime())/864e5)/7)+1,c=new Date(a);c.setDate(a.getDate()+(n-1)*7);let i=new Date(c);return i.setDate(c.getDate()+6),{year:t,month:r+1,week_number:n,start_date:c,end_date:i}}async calculateMealDays(e,t,r){try{let s=t.toISOString().split("T")[0],a=r.toISOString().split("T")[0];console.log("급식일수 계산 시도:",{schoolCode:e,startDateStr:s,endDateStr:a});let{data:o,error:n}=await this.supabase.from("meal_menus").select("meal_date").eq("school_code",e).gte("meal_date",s).lte("meal_date",a);if(n){console.error("급식일수 계산 오류:",n);let e=r.getTime()-t.getTime(),s=Math.ceil(e/864e5),a=Math.floor(.7*s);return console.log("급식일수 추정값 사용:",a),a}let c=o?.length||0;return console.log("급식일수 계산 완료:",c),c}catch(s){console.error("급식일수 계산 예외:",s);let e=Math.floor(.7*Math.ceil((r.getTime()-t.getTime())/864e5));return console.log("급식일수 예외시 추정값 사용:",e),e}}async getQuizResults(e,t,r,s){try{let a=r.toISOString(),o=s.toISOString();console.log("퀴즈 결과 조회 시도 (quiz_results 테이블):",{userId:e,schoolCode:t,startDateStr:a,endDateStr:o,note:"school_code, grade 필드 없음 - user_id로만 필터링"});let{data:n,error:c}=await this.supabase.from("quiz_results").select("id, user_id, is_correct, created_at").eq("user_id",e).gte("created_at",a).lte("created_at",o);if(c)return console.error("퀴즈 결과 조회 오류:",c),console.log("퀴즈 결과 기본값 반환"),{total_quiz_days:0,correct_count:0,accuracy_rate:0,avg_answer_time:0};let i=n||[],l=i.filter(e=>e.is_correct).length,u=i.length,p=u>0?l/u*100:0;return console.log("퀴즈 결과 조회 완료:",{total_quiz_days:u,correct_count:l,accuracy_rate:p,note:"answer_time 필드 없음으로 기본값 0 사용"}),{total_quiz_days:u,correct_count:l,accuracy_rate:p,avg_answer_time:0}}catch(e){return console.error("퀴즈 결과 조회 예외:",e),console.log("퀴즈 결과 예외시 기본값 반환"),{total_quiz_days:0,correct_count:0,accuracy_rate:0,avg_answer_time:0}}}async calculateWeeklyStatistics(e,t,r,s,a){try{let o=this.getWeekInfoByWeekNumber(r,s-1,a);if(!o)return null;let n=new Date(o.start_date),c=new Date(o.end_date);0===n.getDay()&&n.setDate(n.getDate()+1),6===c.getDay()&&c.setDate(c.getDate()-1);let i=await this.calculateMealDays(t,n,c),l=await this.getQuizResults(e,t,n,c),u=i>0&&l.correct_count===i;return{user_id:e,school_code:t,year:r,month:s,week_number:a,period_type:"weekly",total_meal_days:i,total_count:l.total_quiz_days,correct_count:l.correct_count,accuracy_rate:l.accuracy_rate,avg_answer_time:l.avg_answer_time,is_champion:u,determined_at:u?new Date:void 0}}catch(e){return console.error("주장원 통계 계산 오류:",e),null}}async calculateMonthlyStatistics(e,t,r,s){try{let a=new Date(r,s-1,1),o=new Date(r,s,0),n=await this.calculateMealDays(t,a,o),c=await this.getQuizResults(e,t,a,o),i=n>0&&c.correct_count===n;return{user_id:e,school_code:t,year:r,month:s,period_type:"monthly",total_meal_days:n,total_count:c.total_quiz_days,correct_count:c.correct_count,accuracy_rate:c.accuracy_rate,avg_answer_time:c.avg_answer_time,is_champion:i,determined_at:i?new Date:void 0}}catch(e){return console.error("월장원 통계 계산 오류:",e),null}}getWeekInfoByWeekNumber(e,t,r){try{if(r<=0)return console.error("유효하지 않은 주차 번호:",r),null;if(t<0||t>11)return console.error("유효하지 않은 월 (0-11 범위를 벗어남):",t),null;let s=new Date(e,t,1),a=new Date(s),o=s.getDay();a.setDate(1+(0===o?1:(8-o)%7));let n=new Date(a);if(n.setDate(a.getDate()+(r-1)*7),n.getMonth()!==t)return console.error(`주차 번호 ${r}는 ${e}년 ${t+1}월에 존재하지 않음`),null;let c=new Date(n);return c.setDate(n.getDate()+6),{year:e,month:t+1,week_number:r,start_date:n,end_date:c}}catch(e){return console.error("주차 정보 계산 오류:",e),null}}async saveStatistics(e){try{let{error:t}=await this.supabase.from("quiz_champion_history").upsert([{user_id:e.user_id,school_code:e.school_code,year:e.year,month:e.month,week_number:e.week_number,period_type:e.period_type,total_meal_days:e.total_meal_days,total_count:e.total_count,correct_count:e.correct_count,accuracy_rate:e.accuracy_rate,avg_answer_time:e.avg_answer_time,is_champion:e.is_champion,determined_at:e.determined_at?.toISOString(),is_current:!0}],{onConflict:"user_id,school_code,year,month,week_number,period_type"});if(t)return console.error("통계 저장 오류:",t),!1;return!0}catch(e){return console.error("통계 저장 예외:",e),!1}}}let p=new u;async function d(e){try{let{user_id:t,school_code:r,year:s,month:a,week_number:o,period_type:n}=await e.json();if(!t||!r||!s||!a||!n)return c.NextResponse.json({error:"필수 파라미터가 누락되었습니다."},{status:400});if(!["weekly","monthly"].includes(n))return c.NextResponse.json({error:"period_type은 weekly 또는 monthly여야 합니다."},{status:400});let i=null;if("weekly"===n){if(!o)return c.NextResponse.json({error:"주장원 계산시 week_number가 필요합니다."},{status:400});i=await p.calculateWeeklyStatistics(t,r,s,a,o)}else i=await p.calculateMonthlyStatistics(t,r,s,a);if(!i)return c.NextResponse.json({error:"통계 계산에 실패했습니다."},{status:500});if(!await p.saveStatistics(i))return c.NextResponse.json({error:"통계 저장에 실패했습니다."},{status:500});return c.NextResponse.json({success:!0,statistics:i,message:`${"weekly"===n?"주장원":"월장원"} 통계가 계산되었습니다.`})}catch(e){return console.error("장원 통계 계산 API 오류:",e),c.NextResponse.json({error:"서버 오류가 발생했습니다."},{status:500})}}async function _(e){try{let{searchParams:t}=new URL(e.url),r=t.get("user_id"),s=t.get("school_code"),a=t.get("year"),o=t.get("month"),n=t.get("week_number"),i=t.get("period_type")||(n?"weekly":"monthly");if(console.log("\uD83D\uDD0D 장원 통계 조회 API 호출:",{user_id:r,school_code:s,year:a,month:o,week_number:n,period_type:i,url:e.url,timestamp:new Date().toISOString()}),!r||!s||!a||!o)return c.NextResponse.json({error:"필수 파라미터가 누락되었습니다."},{status:400});let u=(0,l.U)().from("quiz_champion_history").select("*").eq("user_id",r).eq("school_code",s).eq("year",parseInt(a)).eq("month",parseInt(o)).eq("period_type",i);n&&"weekly"===i&&(u=u.eq("week_number",parseInt(n)));let{data:d,error:_}=await u.order("created_at",{ascending:!1});if(_)return console.error("장원 통계 조회 오류:",_),c.NextResponse.json({error:"통계 조회에 실패했습니다."},{status:500});if(d&&d.length>0){let e=d[0];return console.log("✅ 기존 통계 데이터 반환:",e),c.NextResponse.json({success:!0,data:{...e,is_champion:e.is_champion,total_meal_days:e.total_meal_days||0,correct_answers:e.correct_count}})}console.log("\uD83D\uDCCA 기존 데이터 없음, 자동 계산 시작...",{period_type:i,week_number:n,user_id:r,school_code:s,grade:parseInt(grade),year:parseInt(a),month:parseInt(o)});let m=null;try{if("weekly"===i&&n?(console.log("\uD83D\uDCC8 주장원 통계 계산 시작..."),m=await p.calculateWeeklyStatistics(r,s,parseInt(grade),parseInt(a),parseInt(o),parseInt(n)),console.log("\uD83D\uDCC8 주장원 통계 계산 결과:",m)):"monthly"===i&&(console.log("\uD83D\uDCCA 월장원 통계 계산 시작..."),m=await p.calculateMonthlyStatistics(r,s,parseInt(grade),parseInt(a),parseInt(o)),console.log("\uD83D\uDCCA 월장원 통계 계산 결과:",m)),!m)return console.log("⚠️ 통계 계산 실패, 기본값 반환"),c.NextResponse.json({success:!0,data:{user_id:r,school_code:s,grade:parseInt(grade),year:parseInt(a),month:parseInt(o),week_number:n?parseInt(n):null,period_type:i,total_meal_days:0,total_count:0,correct_count:0,correct_answers:0,accuracy_rate:0,avg_answer_time:0,is_champion:!1}});{let e=await p.saveStatistics(m);return console.log(e?"✅ 통계 저장 성공":"❌ 통계 저장 실패"),c.NextResponse.json({success:!0,data:{...m,is_champion:m.is_champion,total_meal_days:m.total_meal_days||0,correct_answers:m.correct_count}})}}catch(e){return console.error("❌ 자동 계산 중 오류:",{error:e,message:e?.message,stack:e?.stack,parameters:{user_id:r,school_code:s,grade:parseInt(grade),year:parseInt(a),month:parseInt(o),week_number:n?parseInt(n):null,period_type:i}}),c.NextResponse.json({success:!0,data:{user_id:r,school_code:s,grade:parseInt(grade),year:parseInt(a),month:parseInt(o),week_number:n?parseInt(n):null,period_type:i,total_meal_days:0,total_count:0,correct_count:0,correct_answers:0,accuracy_rate:0,avg_answer_time:0,is_champion:!1}})}}catch(e){return console.error("장원 통계 조회 API 오류:",e),c.NextResponse.json({error:"서버 오류가 발생했습니다."},{status:500})}}let m=new a.AppRouteRouteModule({definition:{kind:o.RouteKind.APP_ROUTE,page:"/api/champion/calculate/route",pathname:"/api/champion/calculate",filename:"route",bundlePath:"app/api/champion/calculate/route"},resolvedPagePath:"D:\\Windsurf\\eat-meal-battle\\apps\\app\\src\\app\\api\\champion\\calculate\\route.ts",nextConfigOutput:"standalone",userland:s}),{workAsyncStorage:h,workUnitAsyncStorage:g,serverHooks:y}=m;function w(){return(0,n.patchFetch)({workAsyncStorage:h,workUnitAsyncStorage:g})}},79428:e=>{"use strict";e.exports=require("buffer")},79551:e=>{"use strict";e.exports=require("url")},80408:()=>{},81630:e=>{"use strict";e.exports=require("http")},84875:(e,t,r)=>{"use strict";r.d(t,{U:()=>o});var s=r(98811),a=r(65208);let o=()=>{let e=(0,a.UL)();return(0,s.Ri)("https://izkumvvlkrkgiuuczffp.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6a3VtdnZsa3JrZ2l1dWN6ZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTI3NzksImV4cCI6MjA2MDk4ODc3OX0.pQH_znuBuBfLBJdnMagX4_HE37Z8uraCp1_MaJFtEfc",{cookies:{get:t=>e.get(t)?.value,set(t,r,s){try{e.set({name:t,value:r,...s})}catch(e){console.error("쿠키 설정 오류:",e)}},remove(t,r){try{e.set({name:t,value:"",...r})}catch(e){console.error("쿠키 삭제 오류:",e)}}},auth:{detectSessionInUrl:!0,persistSession:!0,autoRefreshToken:!0}})}},87032:()=>{},91645:e=>{"use strict";e.exports=require("net")},94735:e=>{"use strict";e.exports=require("events")}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[50,744,156,811,208],()=>r(78374));module.exports=s})();