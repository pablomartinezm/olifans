// node --test lib/tapper.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { barAt, ronda, tapReward } from "./tapper.ts";

test("tapReward: puntos, propinas de Hugo y bonus de récord", () => {
  assert.equal(tapReward({ score: 1000, served: 12, tips: 2, wave: 3 }, false), 50);
  assert.equal(tapReward({ score: 1000, served: 12, tips: 2, wave: 3 }, true), 75);
});

test("ronda: cada vez más clientes, más seguidos y con más prisa, con tope", () => {
  assert.deepEqual(ronda(1), { clientes: 5, cada: 2.38, prisa: 1 });
  assert.ok(ronda(5).clientes > ronda(4).clientes);
  assert.equal(ronda(20).cada, 0.8);
  assert.equal(ronda(20).prisa, 2);
});

test("barAt: la barra según la altura del toque, sin salirse", () => {
  assert.equal(barAt(10, 8, 60), 0);
  assert.equal(barAt(70, 8, 60), 1);
  assert.equal(barAt(-20, 8, 60), 0);
  assert.equal(barAt(999, 8, 60), 3);
});
