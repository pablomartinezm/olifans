// node --test lib/tapper.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { barAt, ronda, tapReward } from "./tapper.ts";

test("tapReward: puntos, propinas de Hugo y bonus de récord", () => {
  assert.equal(tapReward({ score: 1000, served: 12, tips: 2, wave: 3 }, false), 50);
  assert.equal(tapReward({ score: 1000, served: 12, tips: 2, wave: 3 }, true), 75);
});

test("ronda: todo sube un poco cada ronda, en línea recta y con tope", () => {
  assert.deepEqual(ronda(1), { clientes: 5, cada: 1 / 0.55, pares: 0, prisa: 1 });
  const porSegundo = (r: ReturnType<typeof ronda>) => (1 + r.pares) / r.cada;
  for (let n = 1; n < 25; n++) {
    const a = ronda(n), b = ronda(n + 1);
    assert.ok(b.clientes > a.clientes && b.pares >= a.pares && b.prisa >= a.prisa && porSegundo(b) >= porSegundo(a) - 1e-9);
    assert.ok(porSegundo(b) - porSegundo(a) <= 0.12 + 1e-9, `sin saltos: ronda ${n + 1}`);
  }
  assert.equal(ronda(30).prisa, 1.8);
  assert.equal(ronda(30).pares, 0.5);
  assert.ok(Math.abs(porSegundo(ronda(30)) - 2.2) < 1e-9);
});

test("barAt: la barra según la altura del toque, sin salirse", () => {
  assert.equal(barAt(10, 8, 60), 0);
  assert.equal(barAt(70, 8, 60), 1);
  assert.equal(barAt(-20, 8, 60), 0);
  assert.equal(barAt(999, 8, 60), 3);
});
