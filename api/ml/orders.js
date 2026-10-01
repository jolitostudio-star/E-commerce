import { protect } from '../_account.js';
import { listSellerOrders } from '../_orders.js';
import { respondWithSession } from '../_session.js';

function handleGET(request) {
  const days = new URL(request.url).searchParams.get('days');
  return respondWithSession(request, token => listSellerOrders(token, { days }));
}

export const GET = protect(handleGET, {admin:true});
