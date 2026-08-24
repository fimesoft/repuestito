export type Role = 'SELLER' | 'MODERATOR' | 'ADMIN';

const ROLE_RANK: Record<Role, number> = { SELLER: 0, MODERATOR: 1, ADMIN: 2 };

// El backend persiste el rol más alto como 'GOD'; el resto de la app lo conoce como 'ADMIN'.
const BACKEND_ROLE_MAP: Record<string, Role> = {
  SELLER: 'SELLER',
  MODERATOR: 'MODERATOR',
  GOD: 'ADMIN',
};

export function toRole(value: string | undefined): Role | undefined {
  return value ? BACKEND_ROLE_MAP[value] : undefined;
}

export function hasRole(userRole: string | undefined, minRole: Role): boolean {
  const role = toRole(userRole);
  return role !== undefined && ROLE_RANK[role] >= ROLE_RANK[minRole];
}
