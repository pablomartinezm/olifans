// npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buy, equip, finish, fresh, parseSave, spend } from "./tienda.ts";

test("comprar descuenta, se pone, no se compra dos veces y hace falta dinero", () => {
  const s = { ...fresh(), coins: 200 };
  const a = buy(s, "flamencos")!;
  assert.equal(a.coins, 50);
  assert.equal(a.equip.camisa, "flamencos");
  assert.equal(buy(a, "flamencos"), null);
  assert.equal(buy(a, "lenador"), null);
  assert.equal(buy(s, "no-existe"), null);
});

test("power-ups se acumulan y se gastan de uno en uno", () => {
  const s = buy({ ...fresh(), coins: 100 }, "agua")!;
  assert.deepEqual([s.coins, s.inv.agua], [60, 1]);
  const t = spend(s, "agua")!;
  assert.equal(t.inv.agua, 0);
  assert.equal(spend(t, "agua"), null);
});

test("los objetos de la barra se compran y se ponen aparte del fondo", () => {
  const s = buy({ ...fresh(), coins: 600 }, "dedo")!;
  assert.deepEqual([s.coins, s.equip.objeto, s.equip.fondo], [100, "dedo", "bar"]);
  assert.equal(equip(s, "olivas")!.equip.objeto, "olivas");
});

test("la raya se compra como los demás power-ups", () => {
  const s = buy({ ...fresh(), coins: 150 }, "raya")!;
  assert.deepEqual([s.coins, s.inv.raya], [0, 1]);
  assert.equal(spend(s, "raya")!.inv.raya, 0);
});

test("solo te pones lo que tienes", () => {
  assert.equal(equip(fresh(), "disco"), null);
  assert.equal(equip(fresh(), "agua"), null);
  assert.equal(equip(fresh(), "bar")!.equip.fondo, "bar");
});

test("fin de partida: monedas y récord", () => {
  const r = finish(fresh(), { level: 5, pushes: 9, pokes: 1, perfect: 2 });
  assert.equal(r.coins, 5 * 10 + 2 * 5 + 25);
  assert.ok(r.nuevo);
  assert.equal(r.save.best, 5);
  const r2 = finish(r.save, { level: 3, pushes: 0, pokes: 0, perfect: 0 });
  assert.equal(r2.nuevo, false);
  assert.equal(r2.save.coins, r.coins + 30);
});

test("una partida guardada rota o manipulada no rompe nada", () => {
  assert.deepEqual(parseSave("{roto"), fresh());
  const s = parseSave(JSON.stringify({
    coins: -5, best: "mucho", owned: ["disco", "hackeo", 7], equip: { fondo: "disco", camisa: "lenador", gafas: "__proto__" }, inv: { agua: 2.7, hostia: "x" },
  }), 4);
  assert.equal(s.coins, 0);
  assert.equal(s.best, 4); // récord del juego antiguo
  assert.ok(s.owned.includes("disco") && !s.owned.includes("hackeo"));
  assert.deepEqual(s.equip, { camisa: "hawaiana", gafas: "clasicas", fondo: "disco", objeto: "olivas" });
  assert.deepEqual(s.inv, { agua: 2, hostia: 0, raya: 0 });
});
