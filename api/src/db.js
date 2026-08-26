// ÚNICO ponto da API dependente do driver do banco atual.
// Se o PostgreSQL mudar de provedor, a camada superior não precisa mudar.
import { neon } from "@neondatabase/serverless";

export function database(env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  return neon(env.DATABASE_URL);
}
