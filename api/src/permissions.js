// Patrimônio+ | motor de autorização v1 (módulo independente)
// O backend é a única fonte de autorização; a UI nunca substitui estas verificações.
export const PROFILES = Object.freeze(["ADMIN","GESTOR","OPERADOR","CONSULTA"]);
export function normalizeProfile(profile) {
  const p=String(profile || "").toUpperCase();
  return p==="AUXILIAR" ? "OPERADOR" : PROFILES.includes(p) ? p : "CONSULTA";
}
export function calculatePermission({profile, code, exclusiveAdmin=false, inherited=false, override=null}) {
  const role=normalizeProfile(profile);
  if (!code || typeof code!=="string") return false;
  if (exclusiveAdmin) return role==="ADMIN";
  if (role==="CONSULTA") return Boolean(inherited); // consulta estritamente leitura
  if (role==="ADMIN") return true;
  return override===null || override===undefined ? Boolean(inherited) : override===true;
}
export async function loadUserPermissions(sql,user) {
  const perfil=normalizeProfile(user.perfil_acesso || user.perfil);
  const rows=await sql`
    select p.codigo,p.exclusiva_admin, coalesce(pp.permitido,false) as herdada,
           up.permitido as individual
    from permissoes p
    left join perfis_permissoes pp on pp.perfil=${perfil} and pp.permissao_codigo=p.codigo
    left join usuarios_permissoes up on up.usuario_id=${user.id}::uuid and up.permissao_codigo=p.codigo
    order by p.codigo
  `;
  const result={};
  for(const p of rows) {
    result[p.codigo]=calculatePermission({
      profile:perfil,code:p.codigo,exclusiveAdmin:p.exclusiva_admin,
      inherited:p.herdada,override:p.individual
    });
  }
  return result;
}
export function hasPermission(perms,code) {
  return Object.prototype.hasOwnProperty.call(perms||{},code) && perms[code]===true;
}
