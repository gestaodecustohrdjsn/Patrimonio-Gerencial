import assert from "node:assert/strict";
import test from "node:test";
import { passwordHash, randomSalt, newPasswordIterations, MAX_PBKDF2_ITERATIONS } from "../src/security.js";

test("PBKDF2 em Cloudflare não ultrapassa 100 mil iterações para novas senhas", async()=>{
  assert.equal(MAX_PBKDF2_ITERATIONS,100000);
  assert.equal(newPasswordIterations("100000"),100000);
  assert.throws(()=>newPasswordIterations("310000"),/PBKDF2/);
  assert.throws(()=>newPasswordIterations("invalid"),/PBKDF2/);
  const salt=randomSalt();
  const hash=await passwordHash("Senha-temporaria-de-teste",salt,newPasswordIterations("100000"));
  assert.equal(hash.length,64);
  assert.equal(hash,await passwordHash("Senha-temporaria-de-teste",salt,100000));
});
