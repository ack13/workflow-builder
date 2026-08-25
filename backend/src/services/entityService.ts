// Stub for wherever the caller's real records live — orders, tickets,
// applications, deals, whatever. The engine only ever knows entity_type +
// entity_id; it never needs to know the caller's schema beyond this call.
// Implement this to write to whichever table entity_type points at
// (e.g. a lookup like { order: ordersRepo, ticket: ticketsRepo }[entityType]).
export async function updateEntityStatus(entityType: string, entityId: string, status: string) {
  console.log(`[entity] set ${entityType}#${entityId} status=${status}`);
}
