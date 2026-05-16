module.exports=[93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},44856,e=>{"use strict";var t=e.i(64998),r=e.i(42876),a=e.i(57896),n=e.i(50013),s=e.i(93429),i=e.i(14613),o=e.i(27473),l=e.i(4427),d=e.i(93716),u=e.i(25200),p=e.i(67193),c=e.i(51122),x=e.i(38581),E=e.i(10854),_=e.i(17004),h=e.i(93695);e.i(91716);var R=e.i(78997),m=e.i(3368);e.i(58059);var g=e.i(92341);async function v(){await g.sql`
    CREATE TABLE IF NOT EXISTS orgs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      slug text UNIQUE,
      vapi_api_key text,
      retell_api_key text,
      webhook_secret text DEFAULT gen_random_uuid()::text,
      posthog_api_key text,
      mixpanel_token text,
      slack_webhook_url text,
      linear_api_key text,
      created_at timestamptz DEFAULT now()
    )
  `,await g.sql`
    CREATE TABLE IF NOT EXISTS org_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      email text UNIQUE,
      created_at timestamptz DEFAULT now()
    )
  `,await g.sql`
    CREATE TABLE IF NOT EXISTS calls (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      external_call_id text,
      platform text,
      started_at timestamptz,
      ended_at timestamptz,
      duration_seconds int,
      transcript jsonb,
      raw_payload jsonb,
      intent text,
      outcome text,
      outcome_confidence float,
      sentiment_score float,
      flags text[],
      ai_analysis text,
      caller_phone text,
      analysis_status text DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    )
  `,await g.sql`
    CREATE TABLE IF NOT EXISTS weekly_briefings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      week_start date,
      week_end date,
      total_calls int,
      reported_completion_rate float,
      actual_resolution_rate float,
      gap_points int,
      top_failing_intents jsonb,
      hidden_patterns jsonb,
      sprint_recommendation jsonb,
      briefing_markdown text,
      pushed_to_posthog boolean DEFAULT false,
      pushed_to_mixpanel boolean DEFAULT false,
      pushed_to_slack boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )
  `}async function f(e){if(e.nextUrl.searchParams.get("secret")!==process.env.CRON_SECRET)return m.NextResponse.json({error:"Unauthorized"},{status:401});try{return await v(),m.NextResponse.json({migrated:!0})}catch(e){return console.error("[migrate] Error:",e),m.NextResponse.json({error:String(e)},{status:500})}}e.s(["GET",0,f],70196);var w=e.i(70196);let A=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/setup/migrate/route",pathname:"/api/setup/migrate",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/convometrics/landing/app/api/setup/migrate/route.ts",nextConfigOutput:"",userland:w,...{}}),{workAsyncStorage:T,workUnitAsyncStorage:y,serverHooks:C}=A;async function b(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),A.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let m="/api/setup/migrate/route";m=m.replace(/\/index$/,"")||"/";let g=await A.prepare(e,t,{srcPage:m,multiZoneDraftMode:!1});if(!g)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:v,params:f,nextConfig:w,parsedUrl:T,isDraftMode:y,prerenderManifest:C,routerServerContext:b,isOnDemandRevalidate:N,revalidateOnlyGenerated:S,resolvedPathname:U,clientReferenceManifest:k,serverActionsManifest:I}=g,q=(0,o.normalizeAppPath)(m),P=!!(C.dynamicRoutes[q]||C.routes[U]),F=async()=>((null==b?void 0:b.render404)?await b.render404(e,t,T,!1):t.end("This page could not be found"),null);if(P&&!y){let e=!!C.routes[U],t=C.dynamicRoutes[q];if(t&&!1===t.fallback&&!e){if(w.adapterPath)return await F();throw new h.NoFallbackError}}let D=null;!P||A.isDev||y||(D="/index"===(D=U)?"/":D);let O=!0===A.isDev||!P,j=P&&!O;I&&k&&(0,i.setManifestsSingleton)({page:m,clientReferenceManifest:k,serverActionsManifest:I});let L=e.method||"GET",M=(0,s.getTracer)(),H=M.getActiveScopeSpan(),K=!!(null==b?void 0:b.isWrappedByNextServer),B=!!(0,n.getRequestMeta)(e,"minimalMode"),$=(0,n.getRequestMeta)(e,"incrementalCache")||await A.getIncrementalCache(e,w,C,B);null==$||$.resetRequestCache(),globalThis.__incrementalCache=$;let z={params:f,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:O,incrementalCache:$,cacheLifeProfiles:w.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>A.onRequestError(e,t,a,n,b)},sharedContext:{buildId:v}},Y=new l.NodeNextRequest(e),X=new l.NodeNextResponse(t),G=d.NextRequestAdapter.fromNodeNextRequest(Y,(0,d.signalFromNodeResponse)(t));try{let n,i=async e=>A.handle(G,z).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=M.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${L} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",a),n.updateName(t))}else e.updateName(`${L} ${m}`)}),o=async n=>{var s,o;let l=async({previousCacheEntry:r})=>{try{if(!B&&N&&S&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await i(n);e.fetchMetrics=z.renderOpts.fetchMetrics;let o=z.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let l=z.renderOpts.collectedTags;if(!P)return await (0,c.sendResponse)(Y,X,s,z.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(s.headers);l&&(t[_.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==z.renderOpts.collectedRevalidate&&!(z.renderOpts.collectedRevalidate>=_.INFINITE_CACHE)&&z.renderOpts.collectedRevalidate,a=void 0===z.renderOpts.collectedExpire||z.renderOpts.collectedExpire>=_.INFINITE_CACHE?void 0:z.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await A.onRequestError(e,t,{routerKind:"App Router",routePath:m,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:N})},!1,b),t}},d=await A.handleResponse({req:e,nextConfig:w,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:N,revalidateOnlyGenerated:S,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:B});if(!P)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(o=d.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",N?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),y&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,x.fromNodeOutgoingHttpHeaders)(d.value.headers);return B&&P||u.delete(_.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,E.getCacheControlHeader)(d.cacheControl)),await (0,c.sendResponse)(Y,X,new Response(d.value.body,{headers:u,status:d.value.status||200})),null};K&&H?await o(H):(n=M.getActiveScopeSpan(),await M.withPropagatedContext(e.headers,()=>M.trace(u.BaseServerSpan.handleRequest,{spanName:`${L} ${m}`,kind:s.SpanKind.SERVER,attributes:{"http.method":L,"http.target":e.url}},o),void 0,!K))}catch(t){if(t instanceof h.NoFallbackError||await A.onRequestError(e,t,{routerKind:"App Router",routePath:q,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:N})},!1,b),P)throw t;return await (0,c.sendResponse)(Y,X,new Response(null,{status:500})),null}}e.s(["handler",0,b,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:T,workUnitAsyncStorage:y})},"routeModule",0,A,"serverHooks",0,C,"workAsyncStorage",0,T,"workUnitAsyncStorage",0,y],44856)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0jgqsf-._.js.map