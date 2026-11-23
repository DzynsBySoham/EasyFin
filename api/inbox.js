import {makeInboxHandler,redisStore} from '../server/inbox.mjs';
export default async function handler(req,res){
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  const enabled=process.env.EASYFIN_INBOX_ENABLED==='true';
  return makeInboxHandler({store:enabled&&url&&token?redisStore(url,token):null})(req,res);
}
