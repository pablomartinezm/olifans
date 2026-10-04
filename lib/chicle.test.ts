// node --test lib/chicle.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { PJS, SPR, svgPaths } from "./chicle-art.ts";
import { circleRect, cyrillic, garble, reward, segDist } from "./chicle.ts";

test("cyrillic: español escrito con letras rusas, como escribe Gon", () => {
  assert.equal(cyrillic("¡Ojo, que Javi levanta el brazo!"), "¡Охо, ке Хави леванта эл брасо!");
  assert.equal(cyrillic("Hugo"), "Уго");            // la h es muda y la mayúscula pasa a la u
  assert.equal(cyrillic("Chicle"), "Чикле");
  assert.equal(cyrillic("Sanlle"), "Санйе");
  assert.equal(cyrillic("Gente que sigue"), "Хенте ке сиге");
});

test("garble: sobrio no cambia nada; borracho lía letras, siempre igual con la misma semilla", () => {
  const t = cyrillic("¡Rebota en la calva de Ricky!");
  assert.equal(garble(t, 0, 7), t);
  assert.notEqual(garble(t, 1, 7), t);
  assert.equal(garble(t, 0.5, 7), garble(t, 0.5, 7));
  assert.match(garble(t, 1, 7), /^¡.*!$/); // la puntuación se queda
});

test("reward: barriles, chicles, billetes de Hugo y bonus de récord", () => {
  assert.equal(reward({ score: 10, gums: 3, bills: 2 }, false), 33);
  assert.equal(reward({ score: 10, gums: 3, bills: 2 }, true), 58);
});

test("choques: círculo contra rectángulo y distancia a un segmento", () => {
  assert.equal(circleRect(0, 0, 5, 4, -1, 10, 2), true);
  assert.equal(circleRect(0, 0, 5, 6, -1, 10, 2), false);
  assert.equal(segDist(0, 0, 10, 0, 5, 3), 3);
  assert.equal(segDist(0, 0, 10, 0, 13, 4), 5);
});

test("personajes: cada uno tiene sprite normal, de pataleo y de K.O.", () => {
  for (const { id } of PJS) for (const k of [id, `${id}_kick`, `${id}_ko`]) assert.ok(k in SPR, k);
});

test("svgPaths: un trazo por color, solo dentro del recorte", () => {
  const def = { rows: ["ab", "ba"], pal: { a: "#000", b: "#fff" } };
  assert.deepEqual(svgPaths(def, 0, 0, 2, 2), [["#000", "M0 0h1v1h-1zM1 1h1v1h-1z"], ["#fff", "M1 0h1v1h-1zM0 1h1v1h-1z"]]);
  assert.deepEqual(svgPaths(def, 1, 0, 1, 1), [["#fff", "M0 0h1v1h-1z"]]);
});
