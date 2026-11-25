// =====================================================================
// colosseum.js  -  THE COLOSSEUM, west of Starfall.
// It is a town like the others (the map is in maps.js), but three gatekeepers sell entry to a
// GAUNTLET: ten battles in a row with no rest in between. The fights pay no EXP or gold, only
// Battle Points (BP), and the prize counter exchanges BP for things you cannot get anywhere else.
//
// All the numbers are in data.js under "THE COLOSSEUM":
//   ARENA_TIERS   fee, level needed, BP, monsters and champion of each tier
//   PRIZES        what each prize costs          ITEMS   what the prize items do
//
// While a gauntlet is going on, G.bout = { tier, fight, wins }. It is never saved.
// This file is loaded after main.js.
// =====================================================================

const arenaBP = (tier, wins) => wins * ARENA_TIERS[tier].bpWin + (wins >= ARENA_FIGHTS ? ARENA_TIERS[tier].bpClear : 0);

// ---------- the gatekeepers ----------
function arenaKeeper(tier) {
  const t = ARENA_TIERS[tier], lvl = avgLevel();
  const tooLow = lvl < t.minLvl, poor = G.gold < t.fee;
  UI.say(`GATEKEEPER: The ${t.name} trials. ${ARENA_FIGHTS} fights, no rest. ${t.fee} gold to enter` + (t.minLvl > 1 ? `, and only for fighters of LVL ${t.minLvl} or more.` : '.'), () => UI.openMenu({
    x: 60, y: 70, title: `${t.name.toUpperCase()} TRIALS   Gold: ${G.gold}`,
    items: [
      { label: 'Enter', right: t.fee + 'G', disabled: tooLow || poor,
        desc: tooLow ? `Your party must be LVL ${t.minLvl}. (It is LVL ${lvl}.)` : poor ? 'You do not have enough gold.'
            : `Win all ${ARENA_FIGHTS}: ${arenaBP(tier, ARENA_FIGHTS)} BP. Lose a fight and you get nothing.`,
        pick: () => { UI.pop(); startBout(tier); } },
      { label: 'Rules', pick: () => UI.say([
          `${ARENA_FIGHTS} battles, one after another. Nobody heals you in between` + (ARENA_KO_STAYS ? ', and a hero who falls stays down until you revive them.' : '.'),
          'Your own spells and items are allowed. There is no running away, and the fights give no EXP, gold or items.',
          `Every fight you win is worth ${t.bpWin} Battle Points, and beating all ${ARENA_FIGHTS} adds ${t.bpClear} more. After each fight you may withdraw and keep what you have earned.`,
          'But if the party falls, every point earned in that run is lost. Know when to bow out!',
          'When it is over, win or lose, our healers put you back on your feet.']) },
      { label: 'Leave', pick: () => UI.pop() },
    ],
  }));
}

// ---------- the gauntlet ----------
function startBout(tier) {
  const t = ARENA_TIERS[tier];
  G.gold -= t.fee;
  G.bout = { tier, fight: 1, wins: 0 };
  Sfx.play('door');
  UI.say(['The great doors swing open. The crowd roars!', `${t.name} trials - fight 1 of ${ARENA_FIGHTS}.`], nextBoutFight);
}

// Who stands in the sand this time? The last fight is the champion; before that, a group from the tier's lists.
function boutEnemies() {
  const { tier, fight } = G.bout, t = ARENA_TIERS[tier];
  const lvl = extra => clamp(avgLevel() + extra, 1, levelCap());
  if (fight >= ARENA_FIGHTS) return t.champion.map(c => ({ kind: c.kind, lvl: lvl(t.lvl + c.lvl) }));
  const late = fight > ARENA_FIGHTS / 2;
  const count = t.size[fight > 3 ? 1 : 0];
  const level = lvl(t.lvl + Math.floor((fight - 1) * t.lvlGrow));
  return Array.from({ length: count }, () => ({ kind: pick(late ? t.late : t.early), lvl: level }));
}

function nextBoutFight() {
  const champion = G.bout.fight >= ARENA_FIGHTS;
  Battle.start('arena', {
    enemies: boutEnemies(),
    boss: champion,
    music: champion ? 'ArenaBoss' : 'Arena',          // ArenaBoss1.mp3 / Arena1.mp3... (Boss / Battle music if there are none)
    noEscape: true, noRewards: true, keepDown: ARENA_KO_STAYS,
    onWin: boutFightWon,
    onLose: () => endBout('lost'),
  });
}

function boutFightWon() {
  const b = G.bout, t = ARENA_TIERS[b.tier];
  b.wins++;
  if (b.wins >= ARENA_FIGHTS) return endBout('cleared');
  b.fight++;
  const champion = b.fight >= ARENA_FIGHTS;
  const state = G.party.map(h => `${h.name.slice(0, 3)} ${h.hp}/${maxStat(h, 'hp')}`).join('  ');   // how the party is holding up
  const onward = () => UI.openMenu({
    x: 70, y: 80, title: `Fight ${b.wins} won!   BP so far: ${arenaBP(b.tier, b.wins)}`,
    onCancel: () => {},                               // no backing out of this one: choose
    items: [
      { label: champion ? 'Face the champion' : `Fight ${b.fight} of ${ARENA_FIGHTS}`,
        desc: (champion ? `Win, and it is ${arenaBP(b.tier, ARENA_FIGHTS)} BP in all.  ` : '') + state,
        pick: () => { UI.pop(); nextBoutFight(); } },
      { label: 'Withdraw', desc: `Stop here and keep your ${arenaBP(b.tier, b.wins)} BP. (Lose a fight and they are gone.)`,
        pick: () => { UI.pop(); endBout('withdrew'); } },
    ],
  });
  if (champion) UI.say(`The crowd falls silent. Then a chant begins: the ${t.name} champion is coming!`, onward);
  else onward();
}

// how = 'cleared' (won them all), 'lost' or 'withdrew'
function endBout(how) {
  const b = G.bout, t = ARENA_TIERS[b.tier], a = G.arena;
  const bp = how === 'lost' ? 0 : arenaBP(b.tier, b.wins);     // a defeat forfeits everything earned in this run
  G.bout = null;
  a.bp += bp;
  a.best[b.tier] = Math.max(a.best[b.tier] || 0, b.wins);
  if (how === 'cleared') a.clears[b.tier] = (a.clears[b.tier] || 0) + 1;
  fullHeal();                                         // the Colosseum's healers see to everyone
  Sfx.play(how === 'cleared' ? 'save' : 'inn');
  const first = how === 'cleared' ? `The ${t.name} champion falls! The whole Colosseum is on its feet, chanting your names!`
              : how === 'lost' ? `The party is carried out of the arena after ${b.wins} ${b.wins === 1 ? 'win' : 'wins'}.`
              : `The party bows out after ${b.wins} ${b.wins === 1 ? 'win' : 'wins'}.`;
  const points = how === 'lost' ? `The ${arenaBP(b.tier, b.wins)} Battle Points you had earned are forfeit. (BP: ${a.bp})` : `You earn ${bp} Battle Points. (BP: ${a.bp})`;
  UI.say([first, points, 'The healers restore your HP and MP.']);
}

// ---------- the prize counter ----------
function prizeShop(cur = 0) {
  const a = G.arena;
  const items = Object.keys(PRIZES).map(id => {
    const cost = PRIZES[id];
    if (id === 'medal') return {
      label: "Champion's Medal", right: cost + ' BP', disabled: a.bp < cost,
      desc: `+${ARENA_MEDAL_POINTS} to EVERY stat of every hero, forever. (Medals so far: ${a.medals})`,
      pick: (it, menu) => {
        a.bp -= cost; a.medals++;
        for (const h of G.party) for (const key of TOWER_STATS) h.bonus[key] = (h.bonus[key] || 0) + ARENA_MEDAL_POINTS;
        Sfx.play('levelup'); UI.pop();
        UI.say(`The medal is pinned on. +${ARENA_MEDAL_POINTS} to every stat of every hero!`, () => prizeShop(menu.cur));
      } };
    const full = G.items[id] >= MAX_ITEMS;
    return {
      label: ITEMS[id].name, right: full ? 'FULL' : cost + ' BP', disabled: full || a.bp < cost,
      desc: full ? `You cannot carry more than ${MAX_ITEMS} of one item.` : `${ITEMS[id].desc}. You have ${G.items[id]}.`,
      pick: (it, menu) => { a.bp -= cost; G.items[id]++; Sfx.play('buy'); UI.pop(); prizeShop(menu.cur); },
    };
  });
  items.push({ label: 'Leave', pick: () => UI.pop() });
  UI.openMenu({ x: 8, y: 8, title: `PRIZES - Battle Points: ${a.bp}`, items, cur });
}

// ---------- the herald: your record ----------
function arenaHerald() {
  const a = G.arena;
  const lines = Object.keys(ARENA_TIERS).map(tier => {
    const t = ARENA_TIERS[tier], best = a.best[tier] || 0, clears = a.clears[tier] || 0;
    return `${t.name}: ` + (clears ? `champion beaten ${clears} ${clears === 1 ? 'time' : 'times'}.` : best ? `best run ${best} of ${ARENA_FIGHTS} fights.` : 'not yet fought.');
  });
  UI.say(['HERALD: Hear the deeds of these fighters!', lines.join('  '), `HERALD: Battle Points in hand: ${a.bp}. Spend them at the prize counter.`]);
}

// ---------- wiring up the map ----------
{
  const arena = MAPS.arena;
  for (const npc of arena.npcs) {
    if (npc.arena) npc.onBump = () => arenaKeeper(npc.arena);
    if (npc.herald) npc.onBump = arenaHerald;
  }
  arena.doors[arena.doorAt.arena]  = () => UI.say('The great doors are shut. A gatekeeper must let you in.');
  arena.doors[arena.doorAt.prizes] = () => UI.say('Welcome to the prize counter. Battle Points only, champions!', () => prizeShop());
  arena.doors[arena.doorAt.items]  = () => UI.say('Stock up before you step on the sand.', () => itemShop(shopItems()));
  arena.doors[arena.doorAt.inn]    = inn;
}
