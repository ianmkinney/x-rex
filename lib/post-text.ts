import twitter,{type ParseTweetOptions} from 'twitter-text';
// twitter-text replaces, rather than merges, options. Preserve its URL/emoji weights.
const defaults=(twitter as typeof twitter & {configs:{defaults:ParseTweetOptions}}).configs.defaults;
export function parsePost(text:string,limit=280){return twitter.parseTweet(text,{...defaults,maxWeightedTweetLength:limit});}
