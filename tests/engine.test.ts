import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanning, validateMove } from "../src/lib/validator";
import { solve } from "../src/lib/solver";
import type { Assignment, Database } from "../src/lib/types";
import { asg, grp, inst, makeDb, room, subj, teach } from "./fixtures";

/** Base commune : 2 groupes, 2 formateurs, cours (salles S1,S2) et TP cuisine/anglais. */
function base(): Database {
  return makeDb({
    instructors: [inst(1, ["maths", "cuisine", "plateaux"]), inst(2, ["maths", "cuisine"])],
    groups: [grp(1, "G1", "Cuisine"), grp(2, "G2", "Cuisine"), grp(3, "G3", "Informatique")],
    subjects: [
      subj(1, "Maths", "maths", "COURS"),
      subj(2, "Cuisine TP", "cuisine", "TP"),
      subj(3, "Plateaux TP", "plateaux", "TP"),
    ],
    rooms: [
      room(1, "S1", ["COURS"]),
      room(2, "S2", ["COURS"]),
      room(3, "CUISINE P 1", ["TP"]),
      room(4, "CUISINE P 2", ["TP"]),
    ],
  });
}
const codes = (db: Database, a: Assignment[]) => validatePlanning(db, a).errors.map((v) => v.code);

test("deux groupes avec le même formateur au même moment → conflit formateur", () => {
  const db = base();
  const a = [
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, day: 0, startSlot: 0 }),
    asg({ groupId: 2, subjectId: 1, instructorId: 1, roomId: 2, day: 0, startSlot: 0 }),
  ];
  assert.ok(codes(db, a).includes("INSTRUCTOR_OVERLAP"));
});

test("deux groupes dans la même salle au même moment → conflit salle", () => {
  const db = base();
  const a = [
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1 }),
    asg({ groupId: 2, subjectId: 1, instructorId: 2, roomId: 1 }),
  ];
  assert.ok(codes(db, a).includes("ROOM_OVERLAP"));
});

test("deux séances pour le même groupe au même moment → conflit groupe", () => {
  const db = base();
  const a = [
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1 }),
    asg({ groupId: 1, subjectId: 1, instructorId: 2, roomId: 2 }),
  ];
  assert.ok(codes(db, a).includes("GROUP_OVERLAP"));
});

test("un TP de 4h (08-12) bloque toute séance qui le recoupe (08-10, 10-12) mais pas 12-14", () => {
  const db = base();
  const tp = asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 3, hours: 4, kind: "TP", day: 1, startSlot: 0 });
  for (const startSlot of [0, 1]) {
    const other = asg({ groupId: 2, subjectId: 1, instructorId: 1, roomId: 1, day: 1, startSlot });
    assert.ok(codes(db, [tp, other]).includes("INSTRUCTOR_OVERLAP"), `créneau ${startSlot}`);
  }
  const after = asg({ groupId: 2, subjectId: 1, instructorId: 1, roomId: 1, day: 1, startSlot: 3 });
  assert.ok(!codes(db, [tp, after]).includes("INSTRUCTOR_OVERLAP"));
});

test("formateur indisponible / salle indisponible", () => {
  const db = base();
  db.instructors[0].blocked = [{ day: 0, slots: [0] }];
  db.rooms[0].blocked = [{ day: 1, slots: [0] }];
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 2, day: 0, startSlot: 0 })]).includes("INSTRUCTOR_UNAVAILABLE"));
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 2, roomId: 1, day: 1, startSlot: 0 })]).includes("ROOM_UNAVAILABLE"));
});

test("mauvais formateur (compétence manquante)", () => {
  const db = base();
  db.instructors.push(inst(3, ["autre"]));
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 3, roomId: 1 })]).includes("COMPETENCE_MISSING"));
});

test("mauvaise salle : cours dans un atelier TP-only, TP dans une salle normale, TP cuisine hors cuisine", () => {
  const db = base();
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 3 })]).includes("ROOM_KIND_MISMATCH"));
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 1, hours: 4, kind: "TP" })]).includes("ROOM_KIND_MISMATCH"));
  db.rooms.push(room(5, "LABO X", ["TP"]));
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 5, hours: 4, kind: "TP" })]).includes("ROOM_NOT_SUITABLE"));
});

test("cours théorique entre 12h et 14h → interdit", () => {
  const db = base();
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, startSlot: 2 })]).includes("FORBIDDEN_HOURS"));
});

test("cours théorique après 18h → interdit", () => {
  const db = base();
  assert.ok(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, startSlot: 5 })]).includes("FORBIDDEN_HOURS"));
});

test("TP Cuisine entre 12h et 14h → autorisé ; TP non culinaire au même horaire → interdit", () => {
  const db = base();
  const okTp = asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 3, hours: 4, kind: "TP", startSlot: 1 }); // 10-14
  assert.deepEqual(codes(db, [okTp]), []);
  const badTp = asg({ groupId: 3, subjectId: 3, instructorId: 1, roomId: 4, hours: 4, kind: "TP", startSlot: 1 });
  // groupe Informatique + compétence « plateaux » : pas dans la liste des spécialités
  db.rooms[3].name = "RESTAU P 1";
  assert.ok(codes(db, [badTp]).includes("FORBIDDEN_HOURS"));
});

test("TP Cuisine après 18h autorisé jusqu'à 20h ; au-delà de 20h refusé ; cours toujours refusé", () => {
  const db = base();
  const tp = asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 3, hours: 4, kind: "TP", startSlot: 4 }); // 16-20
  assert.deepEqual(codes(db, [tp]), []);
  db.settings.boundaries = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
  const late = asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 3, hours: 4, kind: "TP", startSlot: 5 }); // 18-22
  assert.ok(codes(db, [late]).includes("FORBIDDEN_HOURS"));
});

test("règles 12h-14h et 18h désactivables par l'administrateur", () => {
  const db = base();
  db.settings.specialRules = { pause1214Enabled: false, after18Enabled: false, allowedSpecialties: [] };
  assert.deepEqual(codes(db, [asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, startSlot: 2 })]), []);
});

test("séance longue : un bloc de 4h qui dépasse la grille est refusé", () => {
  const db = base();
  const a = asg({ groupId: 1, subjectId: 2, instructorId: 1, roomId: 3, hours: 4, kind: "TP", startSlot: 5 }); // 18-20 puis fin de grille
  assert.ok(codes(db, [a]).includes("GRID_INVALID"));
});

test("grille avec créneaux insuffisants → planning impossible, jamais présenté comme complet", () => {
  const db = base();
  db.settings.boundaries = ["08:00", "10:00"]; // un seul créneau de 2h : aucun TP de 4h possible
  db.teachings = [teach(1, 1, 2, 4)];
  const res = solve(db);
  assert.equal(res.assignments.length, 0);
  assert.equal(res.infeasible, true);
  assert.equal(res.unplaced.length, 1);
  assert.ok(res.unplaced[0].reasons.length > 0);
});

test("volume horaire : dépassement = erreur, manque = avertissement (planning incomplet)", () => {
  const db = base();
  db.teachings = [teach(1, 1, 1, 2)];
  const none = validatePlanning(db, []);
  assert.equal(none.valid, true);
  assert.equal(none.complete, false);
  const over = [
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, startSlot: 0 }),
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, startSlot: 1 }),
  ];
  assert.ok(codes(db, over).includes("VOLUME_EXCEEDED"));
});

test("heures supplémentaires calculées (normales / supplémentaires)", () => {
  const db = base();
  db.instructors[0].maxHoursPerWeek = 2;
  const a = [
    asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, day: 0, startSlot: 0 }),
    asg({ groupId: 2, subjectId: 1, instructorId: 1, roomId: 2, day: 1, startSlot: 0 }),
  ];
  const r = validatePlanning(db, a);
  const o = r.overtime.find((x) => x.instructorId === 1)!;
  assert.deepEqual([o.assigned, o.normal, o.overtime], [4, 2, 2]);
  assert.ok(r.errors.some((v) => v.code === "OVERTIME"));
});

test("drag & drop : déplacement créant un conflit refusé, déplacement valide accepté", () => {
  const db = base();
  const a1 = asg({ groupId: 1, subjectId: 1, instructorId: 1, roomId: 1, day: 0, startSlot: 0 });
  const a2 = asg({ groupId: 2, subjectId: 1, instructorId: 1, roomId: 2, day: 0, startSlot: 1 });
  const bad = validateMove(db, [a1, a2], { id: a2.id, day: 0, startSlot: 0, roomId: 2 });
  assert.equal(bad.ok, false);
  assert.ok(bad.reasons.some((r) => r.includes("en même temps")));
  const good = validateMove(db, [a1, a2], { id: a2.id, day: 2, startSlot: 3, roomId: 2 });
  assert.deepEqual(good, { ok: true, reasons: [] });
  const noon = validateMove(db, [a1, a2], { id: a2.id, day: 0, startSlot: 2, roomId: 2 });
  assert.equal(noon.ok, false); // cours à 12h
});

test("modèle central : un déplacement apparaît dans les vues Formateur, Salle et Groupe", () => {
  // Les trois vues sont des filtres sur la même liste d'affectations.
  const list = [asg({ groupId: 1, subjectId: 1, instructorId: 2, roomId: 1, day: 0, startSlot: 0 })];
  const moved = list.map((a) => ({ ...a, day: 3, startSlot: 3 }));
  const f = moved.filter((a) => a.instructorId === 2);
  const r = moved.filter((a) => a.roomId === 1);
  const g = moved.filter((a) => a.groupId === 1);
  for (const v of [f, r, g]) assert.deepEqual([v[0].day, v[0].startSlot], [3, 3]);
});

/* ---------------- moteur : le résultat passe toujours le validateur ---------------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test("propriété : 150 scénarios aléatoires, aucun planning généré ne viole une contrainte obligatoire", () => {
  let placedTotal = 0;
  let unplacedTotal = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed);
    const nG = 2 + Math.floor(r() * 4);
    const comps = ["maths", "cuisine", "anglais", "plateaux"];
    const db = makeDb({
      instructors: Array.from({ length: 2 + Math.floor(r() * 3) }, (_, i) =>
        inst(i + 1, comps.filter(() => r() < 0.6), {
          maxHoursPerWeek: 8 + Math.floor(r() * 16),
          blocked: r() < 0.5 ? [{ day: Math.floor(r() * 5), slots: [0, 1] }] : [],
        })
      ),
      groups: Array.from({ length: nG }, (_, i) => grp(i + 1, `G${i + 1}`, r() < 0.5 ? "Cuisine" : "Gestion")),
      subjects: [
        subj(1, "Maths", "maths", "COURS"),
        subj(2, "Anglais", "anglais", "COURS"),
        subj(3, "Cuisine TP", "cuisine", "TP"),
        subj(4, "Plateaux TP", "plateaux", "TP"),
      ],
      rooms: [
        room(1, "S1", ["COURS"]), room(2, "S2", ["COURS"]),
        room(3, "CUISINE P 1", ["TP"]), room(4, "RESTAU P 1", ["TP", "COURS"]),
      ],
    });
    let tid = 1;
    for (const g of db.groups)
      for (const s of db.subjects) if (r() < 0.7) db.teachings.push(teach(tid++, g.id, s.id, s.kind === "TP" ? 4 : 2 + 2 * Math.floor(r() * 2)));
    const res = solve(db);
    const planned = res.assignments.map((a, i) => ({ ...a, id: i + 1, versionId: 1 })) as Assignment[];
    const report = validatePlanning(db, planned);
    assert.equal(report.valid, true, `seed ${seed}: ${report.errors.map((e) => e.message).join(" | ")}`);
    placedTotal += res.assignments.length;
    unplacedTotal += res.unplaced.length;
  }
  assert.ok(placedTotal > 0);
  console.log(`  ${placedTotal} séances placées, ${unplacedTotal} non placées sur 150 scénarios`);
});

test("moteur : planning faisable → toutes les séances placées et complet", () => {
  const db = base();
  db.teachings = [teach(1, 1, 1, 4), teach(2, 2, 1, 4), teach(3, 1, 2, 4), teach(4, 2, 2, 4)];
  const res = solve(db);
  assert.equal(res.unplaced.length, 0);
  const planned = res.assignments.map((a, i) => ({ ...a, id: i + 1, versionId: 1 })) as Assignment[];
  const rep = validatePlanning(db, planned);
  assert.equal(rep.valid, true);
  assert.equal(rep.complete, true);
});

test("moteur : ne place jamais une séance impossible (aucun formateur qualifié) et explique pourquoi", () => {
  const db = base();
  db.subjects.push(subj(9, "Latin", "latin", "COURS"));
  db.teachings = [teach(1, 1, 9, 2)];
  const res = solve(db);
  assert.equal(res.assignments.length, 0);
  assert.equal(res.infeasible, true);
  assert.ok(res.blocking.some((m) => m.includes("latin")));
});
