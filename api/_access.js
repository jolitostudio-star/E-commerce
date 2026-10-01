// Verified owner account, configured separately from customer purchases.
const projectOwner = 'ed42b09e-1af3-4e3f-8ea1-496a305ae33b';
export function isAdmin(user) {
  const owners = (process.env.ADMIN_USER_IDS || projectOwner).split(',').map(value => value.trim());
  return Boolean(user?.id && owners.includes(user.id));
}
