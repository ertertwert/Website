// =====================================================================
// reef.js  -  THE CORAL DEEP  (New Game+ only: sail the boat into the whirlpool in the south-east sea)
//
// The biggest dungeon in the game: 40 floors, always the same (unlike the Endless Tower).
//
//   FLOORS     Every ten floors look different and have their own monsters, brighter and more
//              overgrown with coral the deeper you go:
//                 1-10  the Drowned Shallows     11-20  the Coral Gardens
//                21-30  the Reef Heart           31-40  the Bloom
//   BOSSES     Floors 10, 20, 30 and 40. A boss blocks the way down until it is beaten.
//   CHECKPOINTS  Beating the boss of floor 10, 20 or 30 lets you dive straight to the floor below it
//              from then on (kept for ever, even through New Game+).
//   REWARDS    The first victory over each boss gives something that is kept for ever:
//                floor 10  ARTUROS learns Double Cut        floor 20  SORUTRA learns Refresh
//                floor 30  RAYEN learns Ultima              floor 40  the relic Pre-Emptive Strike
//              Every victory also adds permanent stat points (REEF_STAT_POINTS in data.js).
//   RULES      Like the story dungeons: no saving inside, Warp takes you out, and if the party
//              falls you wake at the inn with half your gold. Bosses and chests come back with
//              each New Game+ cycle; checkpoints and rewards do not have to be won again.
//
// G.reef = { checkpoint, deepest, kills: { 10: 2, ... }, points }   (saved with the game)
// The monsters, the three reward abilities and the numbers to tune are in data.js.
// This file is loaded last, after main.js.
// =====================================================================

const REEF_SEED = 9001;               // change this number and all forty floors get new layouts
const REEF_W = 29, REEF_H = 19;       // the size of a floor in tiles (odd numbers; the story dungeons are 25 x 17)

// one entry for every ten floors: the name, the tiles it is built from, and its monsters (ZONES in data.js)
const REEF_TIERS = [
  { name: 'Drowned Shallows', wall: '1', floor: '5', zone: 'reefa' },
  { name: 'Coral Gardens',    wall: '2', floor: '6', zone: 'reefb' },
  { name: 'Reef Heart',       wall: '3', floor: '7', zone: 'reefc' },
  { name: 'The Bloom',        wall: '4', floor: '8', zone: 'reefd' },
];
const reefTier = floor => REEF_TIERS[Math.floor((floor - 1) / 10)];

// The bosses.  enemies: who you fight (the first one is the figure standing on the map)
//              reward: { hero, spell } = that hero learns the spell,  { relic } = a relic (RELICS in data.js)
const REEF_BOSSES = {
  10: { name: 'Reef Warden', enemies: ['reefwarden'], reward: { hero: 'arturos', spell: 'doublecut' },
        intro: ['A crab the size of a house blocks the tunnel, claws raised.', 'When it gathers its strength, DEFEND - its CRUSHING TIDE hits everyone.'] },
  20: { name: 'Siren Queen', enemies: ['tidesinger', 'sirenqueen', 'tidesinger'], reward: { hero: 'sorutra', spell: 'refresh' },
        intro: ['SIREN QUEEN: Such tired little sailors. Sleep. I will sing you down.', 'Her Tide Singers heal her. Silence them, or deal with them first.'] },
  30: { name: 'Chroma Hydra', enemies: ['hydra'], reward: { hero: 'rayen', spell: 'ultima' },
        intro: ['The coral itself uncoils. Its scales run through every colour.', 'Its weakness changes every round, and it shrugs off everything else.'] },
  40: { name: 'Leviathan', enemies: ['leviathan'], reward: { relic: 'leviathan' },
        intro: ['The floor of the sea opens one enormous eye.', 'LEVIATHAN. Its weakness shifts, its MAELSTROM must be braced for, and wounded it only grows wilder.'] },
};

// What the two chests of a floor hold. Gold is worth little this late in the game, so these are all
// things you can use: healing, revival, cures and Ward Charms. (They are given exactly as listed here;
// the New Game+ chest upgrade in data.js does not touch them.) Each list is gone through floor by floor.
const REEF_CHEST_A = [{ item: 'elixir', n: 2 }, { item: 'hiether', n: 3 }, { item: 'revive', n: 2 }, { item: 'elixir', n: 1 }, { item: 'hipotion', n: 4 }];
const REEF_CHEST_B = [{ item: 'ward', n: 3 }, { item: 'remedy', n: 2 }, { item: 'hiether', n: 2 }, { item: 'ward', n: 2 }, { item: 'revive', n: 1 }, { item: 'elixir', n: 1 }];
function reefTreasure(floor) {
  const gear = { 32: { weapon: 'staff', tier: 15 }, 34: { weapon: 'bow', tier: 15 }, 36: { weapon: 'sword', tier: 15 },
                 37: { armor: 15 }, 38: { armor: 15 }, 39: { armor: 15 } }[floor];          // the Tidecaller weapons and three Abyssal Mails
  return [REEF_CHEST_A[floor % REEF_CHEST_A.length], gear || REEF_CHEST_B[floor % REEF_CHEST_B.length]];
}
const REEF_FINAL_CHEST = [{ item: 'elixir', n: 5 }, { item: 'ward', n: 5 }, { item: 'revive', n: 3 }];   // behind Leviathan

// ---------- building the forty floors (maps r1 ... r40) ----------
function buildCoralDeep() {
  for (let n = 1; n <= REEF_FLOORS; n++) {
    const tier = reefTier(n), boss = REEF_BOSSES[n], last = n === REEF_FLOORS;
    // (should a layout ever fail to build, the next seed is tried, so a floor can never be missing)
    let made = null;
    for (let attempt = 0; !made && attempt < 20; attempt++) {
      try {
        made = generateFloor(REEF_SEED + n * 131 + attempt * 7919, REEF_W, REEF_H, {
          wall: tier.wall, floor: tier.floor, loops: 8, chests: 2,
          entry: n === 1 ? 'E' : '<',
          next: boss ? null : '>',                              // boss floors have no open stairs...
          guard: boss ? (last ? 'chest' : 'exit') : null,      // ...the boss guards a hidden way down (or, at the very bottom, a chest)
        });
      } catch (e) { made = null; }
    }
    const exits = {};
    if (n === 1) exits.E = { to: 'world', at: '@', dir: 'down' };                    // back up to the whirlpool
    else exits['<'] = { to: 'r' + (n - 1), at: REEF_BOSSES[n - 1] ? 'S' : '>' };     // up one floor
    if (!boss) exits['>'] = { to: 'r' + (n + 1), at: '<' };                          // down one floor
    else if (!last) exits.S = { to: 'r' + (n + 1), at: '<' };                        // the way the boss was guarding

    const map = makeDungeon('r' + n, made.lines, {
      wall: tier.wall, floor: tier.floor, zone: tier.zone, exits,
      boss: boss ? boss.enemies.find(kind => ENEMIES[kind].boss) : null, bossFlag: 'reefBoss' + n,
    });
    const treasure = reefTreasure(n);
    made.chests.forEach((c, i) => { map.chests[c[0] + ',' + c[1]] = treasure[i]; });
    if (made.bossChest) map.chests[made.bossChest[0] + ',' + made.bossChest[1]] = REEF_FINAL_CHEST;
    for (const npc of map.npcs) { npc.name = boss.name; npc.onBump = () => reefBossFight(n); }   // the only figures here are the bosses
    map.place = `Coral Deep - ${tier.name} - Floor ${n} of ${REEF_FLOORS}`;
    map.music = 'Reef';                                         // Reef1.mp3, Reef2.mp3... (Dungeon music if there are none)
    map.reefFloor = n;
    map.exactLoot = true;                                       // chests hold exactly what reefTreasure says
    MAPS['r' + n] = map;
  }
}
buildCoralDeep();

// ---------- the whirlpool ----------
// Sailing onto it asks where to dive to: the top, or just below any checkpoint already won.
function askCoralDeep() {
  const items = [{ label: 'Dive to floor 1', pick: () => diveCoralDeep(1), desc: '40 floors. No saving inside. Warp brings you back up.' }];
  for (let c = 10; c <= G.reef.checkpoint; c += 10) {
    items.push({ label: `Dive to floor ${c + 1}`, pick: () => diveCoralDeep(c + 1), desc: `Start below the ${REEF_BOSSES[c].name}, in the ${reefTier(c + 1).name}.` });
  }
  items.push({ label: 'Records', pick: () => UI.openCustom(drawReefRecords) });
  items.push({ label: 'Sail on', pick: () => UI.pop() });
  Sfx.play('door');
  UI.openMenu({ x: 40, y: 60, title: 'A great whirlpool turns here. Dive in?', items });
}
function diveCoralDeep(floor) {
  const map = MAPS['r' + floor], start = findTile(map, floor === 1 ? 'E' : '<');
  G.flags.caveEntry = '@';                                      // Warp brings us back to the whirlpool
  UI.clear();
  Sfx.play('warp');
  enterMap('r' + floor, start.x, start.y, 'down');
  if (!G.reef.seenIntro) {
    G.reef.seenIntro = true;
    UI.say(['The whirlpool pulls the boat under... and sets the heroes down, dry, in a cavern of drowned stone.',
            'THE CORAL DEEP. Forty floors. A guardian waits on every tenth, and the monsters here are stronger than anything above.']);
  }
}

// ---------- the bosses ----------
function reefBossFight(floor) {
  const boss = REEF_BOSSES[floor], zone = reefTier(floor).zone;
  const lvl = clamp(avgLevel() + ZONE_LEVEL_BONUS[zone] + REEF_BOSS_LEVELS, 1, levelCap());
  UI.say(boss.intro, () => Battle.start(zone, {
    boss: true, music: 'ReefBoss',                              // ReefBoss1.mp3... (Boss music if there are none)
    enemies: boss.enemies.map(kind => ({ kind, lvl: ENEMIES[kind].boss ? lvl : lvl - REEF_BOSS_LEVELS })),
    onWin: () => reefBossBeaten(floor),
  }));
}
function reefBossBeaten(floor) {
  const boss = REEF_BOSSES[floor], reef = G.reef, reward = boss.reward, points = REEF_STAT_POINTS[floor] || 0;
  G.flags['reefBoss' + floor] = true;                           // the boss is gone: the way down (or the last chest) is open
  reef.kills[floor] = (reef.kills[floor] || 0) + 1;
  Sfx.play('save');
  const pages = [floor === REEF_FLOORS ? 'Leviathan sinks into the dark. The Coral Deep is conquered!'
                                       : `${boss.name} is beaten, and the way down opens.`];
  if (floor < REEF_FLOORS && floor > reef.checkpoint) {
    reef.checkpoint = floor;
    pages.push(`CHECKPOINT: from now on you can dive straight to floor ${floor + 1}.`);
  }
  // the reward that is only given once
  if (reward.spell) {
    const hero = G.party.find(h => h.id === reward.hero), spell = SPELLS[reward.spell];
    if (hero && !hero.extra.includes(reward.spell)) {
      hero.extra.push(reward.spell);
      pages.push(`${hero.name} learns ${spell.name.toUpperCase()}!  ${describeSpell(spell, hero)}`);
    }
  } else if (reward.relic && !hasRelic(reward.relic)) {
    G.tower.relics[reward.relic] = true;                        // relics are all kept in one place (see hasRelic in data.js)
    pages.push(`RELIC FOUND: ${RELICS[reward.relic].name}!  ${RELICS[reward.relic].desc}  It is yours forever.`);
  }
  // ...and the one that is given every time
  if (points) {
    for (const h of G.party) for (const key of TOWER_STATS) h.bonus[key] = (h.bonus[key] || 0) + points;
    reef.points += points;
    pages.push(`The deep's power flows into the heroes: +${points} to EVERY stat of every hero, forever.`);
  }
  UI.say(pages, () => Sfx.play('levelup'));
}

// ---------- the records page ----------
function drawReefRecords() {
  const reef = G.reef;
  drawWindow(8, 8, 304, 224);
  let y = 14;
  const line = (text, color = '#fff', x = 16) => { drawText(text, x, y, color); y += 11; };
  line('THE CORAL DEEP', '#ffd75e');
  line(`Deepest floor: ${reef.deepest} of ${REEF_FLOORS}     Checkpoint: Floor ${reef.checkpoint ? reef.checkpoint + 1 : 1}`);
  line(`Permanent bonus won here: +${reef.points} to all stats`);
  y += 4; line('GUARDIANS AND THEIR REWARDS', '#ffd75e');
  for (const floor in REEF_BOSSES) {
    const boss = REEF_BOSSES[floor], won = reef.kills[floor] || 0, r = boss.reward;
    line(`Floor ${floor}   ${won ? boss.name : '? ? ?'}`.padEnd(30) + `x ${won}`, won ? '#fff' : '#8088a8');
    const what = r.spell ? `${G.party.find(h => h.id === r.hero).name}: ${SPELLS[r.spell].name}` : `Relic: ${RELICS[r.relic].name}`;
    line(won ? what : 'Beat the guardian to find out.', won ? '#7dff9a' : '#8088a8', 26);
    if (won) wrapText(r.spell ? describeSpell(SPELLS[r.spell], G.party.find(h => h.id === r.hero)) : RELICS[r.relic].desc, 266).forEach(text => line(text, '#b8c4ff', 26));
  }
}
