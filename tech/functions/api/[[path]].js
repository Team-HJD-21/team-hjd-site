import { handleSubscription } from '../../src/subscriptions.mjs';
export const onRequest = ({request,env}) => handleSubscription(request,env);
