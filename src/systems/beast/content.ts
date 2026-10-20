/**
 * Beast Offense 2026, built for a 2nd / 3rd grade team. Source: my own Beast playbook (Playmaker export
 * 2026-02-28: formations, run plays, pass plays, Call Sheet V3) plus the check-with-me no-huddle from
 * Youth Football Online's "No Huddle Beast Offense | Check With Me Play Calling System".
 *
 * One language for the whole season:
 * - the WRISTBAND NUMBER is the concept (1 to 10, same as Call Sheet V3),
 * - the COLOR is the side the Y and the wings line up on (Red = right, Yellow = left),
 * - the PLAY NUMBER keeps the hole system (first digit = who carries, second = the hole, even right, odd left),
 * - the KID NAME is what the players say, and its first letter is the check-with-me city.
 */

export const BEAST_SYSTEM_ID = 'beast-2026';
export const BEAST_ID_PREFIX = 'beast26-';
export const BEAST_TAG = 'beast-2026';
export const BEAST_PLAYBOOK_ID = 'beast26-playbook';

export type Side = 'right' | 'left';

export const COLORS = {
  right: { word: 'Red', hex: '#D0021B', ink: '#ffffff', formation: 'Beast Right' },
  left: { word: 'Yellow', hex: '#FFD60A', ink: '#000000', formation: 'Beast Left' },
} as const;

export type ConceptKind = 'run' | 'pass' | 'special';

export type Concept = {
  /** Wristband number. Same number both sides; the color picks the side. */
  n: number;
  key: string;
  /** What the kids call it. Every first letter is different so the city code works. */
  kid: string;
  /** The Call Sheet V3 word. */
  coach: string;
  kind: ConceptKind;
  /** Play numbers from my Beast sheets. 0 = no number (passes and Ice). */
  numbers: Record<Side, number>;
  /** Who gets the ball. */
  carrier: string;
  /** Where it goes, in kid words. */
  where: string;
  /** true = the ball goes the way the Y and the wings line up; false = it goes away from them (the trick plays). */
  withWings: boolean;
  /** One line a 7 year old can say back. */
  kidSays: string;
  /** Hand signal from the sideline. */
  signal: string;
  /** Check-with-me words. Any word that starts with the same letter means the same play. */
  cities: string[];
  /** Call Sheet V3 city, for reference while the coaches switch over. */
  oldCity?: string;
  /** Install week (see INSTALL). */
  week: number;
  coachNote: string;
};

export const CONCEPTS: Concept[] = [
  {
    n: 1, key: 'train', kid: 'Train', coach: 'ISO', kind: 'run', numbers: { right: 12, left: 11 },
    carrier: '1', where: 'A gap, right next to the center', withWings: true,
    kidSays: '2 is the engine, 1 is the caboose. Follow the train through the A gap.',
    signal: 'Pull the train whistle twice', cities: ['Tyler', 'Tennessee'], oldCity: 'Indiana', week: 1,
    coachNote: '2 leads on the first linebacker in the A gap. Center and playside guard double the nose, one climbs. 1 presses the hole and cuts off 2.',
  },
  {
    n: 2, key: 'hammer', kid: 'Hammer', coach: 'Blast', kind: 'run', numbers: { right: 14, left: 13 },
    carrier: '1', where: 'B gap, between the guard and the tackle', withWings: true,
    kidSays: '2 swings the hammer on the linebacker. 1 runs right behind him through the B gap.',
    signal: 'Pound a fist into your hand', cities: ['Houston', 'Hawaii'], oldCity: 'Boston', week: 2,
    coachNote: 'Playside tackle blocks OUT on the end man, the only out block. Y skips the end and goes Down to the linebacker. 2 leads through B.',
  },
  {
    n: 3, key: 'rocket', kid: 'Rocket', coach: 'Sweep', kind: 'run', numbers: { right: 18, left: 17 },
    carrier: '1', where: 'Outside, around the end', withWings: true,
    kidSays: 'Everybody blasts off to the outside. 1 gets to the edge, then turns up.',
    signal: 'Shoot a hand up like a rocket', cities: ['Rockwall', 'Rhode Island'], oldCity: 'Syracuse', week: 2,
    coachNote: 'Line is all GOD (everyone seals inside). 2, Y, 3 and 4 lead outside. 1 runs flat until the crease shows, then gets vertical.',
  },
  {
    n: 4, key: 'crossover', kid: 'Crossover', coach: 'GH Counter', kind: 'run', numbers: { right: 15, left: 16 },
    carrier: '1', where: 'B gap on the side AWAY from the wings', withWings: false,
    kidSays: 'Fake one way like a crossover dribble, then cut back the other way.',
    signal: 'Crossover dribble', cities: ['Carrollton', 'Colorado'], oldCity: 'Cleveland', week: 3,
    coachNote: '2 and 4 sell Rocket. 3 crosses the formation and leads through the hole. F blocks the end man out. 1 takes one jab step to the wings, then cuts back.',
  },
  {
    n: 5, key: 'limo', kid: 'Limo', coach: 'Buck', kind: 'run', numbers: { right: 23, left: 24 },
    carrier: '2', where: 'Off tackle AWAY from the wings, behind two pullers', withWings: false,
    kidSays: 'The guard and the center are the limo drivers. 2 rides behind them.',
    signal: 'Turn a steering wheel', cities: ['Lewisville', 'Louisiana'], oldCity: 'Buffalo', week: 5,
    coachNote: 'Away-side guard pulls and kicks out the first man past the end. Center pulls and leads up to the linebacker. Wing-side guard blocks back for the center.',
  },
  {
    n: 6, key: 'elevator', kid: 'Elevator', coach: 'Flood Pass', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'Y or 4', where: 'Y corner high, 4 out low', withWings: true,
    kidSays: 'Look high first (Y on the corner), then come down the elevator to 4 on the out.',
    signal: 'Hand goes up, then down', cities: ['El Paso', 'Erie'], week: 9,
    coachNote: 'Two-man read, high to low. F, 2 and 3 stay in and protect. If both are covered, 1 tucks and runs.',
  },
  {
    n: 7, key: 'magic', kid: 'Magic', coach: 'Sweep Pass', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'Y or F', where: 'Fake Rocket, throw to Y on the corner', withWings: true,
    kidSays: 'It looks exactly like Rocket. Then poof, 1 throws it.',
    signal: 'Wave a magic wand', cities: ['Mesquite', 'Maine'], oldCity: 'Seattle', week: 6,
    coachNote: 'Everyone sells Rocket for two steps. Y corner is the first look, F post from the back side is second. 2 blocks the back side end.',
  },
  {
    n: 8, key: 'pop', kid: 'Pop', coach: 'TE Pop Pass', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'F or Y', where: 'Quick throw to F up the seam', withWings: true,
    kidSays: 'F pops open right away. Throw it on time.',
    signal: 'Pop your hand open (fist to fingers)', cities: ['Plano', 'Pennsylvania'], oldCity: 'Tampa', week: 8,
    coachNote: 'Quick game. F seam first, Y seam second, 2 to the flat as the outlet. 3 and 4 stay in.',
  },
  {
    n: 9, key: 'boomerang', kid: 'Boomerang', coach: 'Reverse', kind: 'run', numbers: { right: 47, left: 48 },
    carrier: '4', where: 'Outside on the side AWAY from the wings', withWings: false,
    kidSays: 'The ball goes one way, then comes back around the other side.',
    signal: 'Throw a boomerang', cities: ['Bedford', 'Boston'], oldCity: 'Reno', week: 9,
    coachNote: '1 runs the Rocket action and hands to 4 coming back. 3 crosses and leads, F blocks the force player out. Line sells Rocket, then cuts off.',
  },
  {
    n: 10, key: 'ice', kid: 'Ice', coach: 'ICE', kind: 'special', numbers: { right: 0, left: 0 },
    carrier: '1', where: 'Nobody moves', withWings: true,
    kidSays: 'Freeze! Nobody moves. If a defender jumps across, the center snaps it and 1 runs right behind him.',
    signal: 'Hug yourself and shiver', cities: ['Irving', 'Iowa'], week: 3,
    coachNote: 'Freeze play to draw the defense offside. Run it on 4th and short or after a timeout. Only the center and 1 can move, and only if a defender crosses the line.',
  },
];

export const conceptByKey = new Map(CONCEPTS.map((c) => [c.key, c]));

/** Snap count. "Red" in the old cadence clashed with Red = right, so the first word is "Ready". */
export const CADENCE = 'Ready ... Set ... GO!';

export const DAYS = [
  { day: 'Monday', means: 'Snap on the first GO.', why: 'Monday is the first day of the week.' },
  { day: 'Saturday', means: 'Snap on SET.', why: 'Saturday and Set start with S. Quick snap for passes and tempo.' },
  { day: 'Friday', means: 'Fake count first. Nobody moves on the first Ready, Set, GO. Snap on the second GO.', why: 'Friday = Freeze first. Makes the defense jump.' },
];

export const FREEZE_WORDS = ['Ice', 'Friday'];

/** Kid jobs. Same letter on every play. */
export const POSITIONS = [
  { label: '1', kid: 'The Boss', job: 'Gets the snap. Runs most of the plays, hands off on Limo and Boomerang, throws on the passes.', lineup: 'Behind the center, 4 yards back.' },
  { label: '2', kid: 'The Bulldozer', job: 'Leads the way for 1 on Train and Hammer. Carries the ball on Limo.', lineup: 'Next to 1, one step to the wing side.' },
  { label: '3', kid: 'Wing 3', job: 'Inside wing. Blocks, and crosses to lead on Crossover and Boomerang.', lineup: 'One yard back, between the tackle and the Y.' },
  { label: '4', kid: 'Wing 4', job: 'Outside wing. Blocks, catches the out on Elevator, carries Boomerang.', lineup: 'One yard back, just outside the Y.' },
  { label: 'Y', kid: 'The Anchor', job: 'End on the wing side. Wherever Y goes is the color side.', lineup: 'On the line, next to the tackle on the color side.' },
  { label: 'F', kid: 'The Fence', job: 'End on the other side. Shuts the back door and catches Pop.', lineup: 'On the line, next to the tackle away from the wings.' },
  { label: 'C', kid: 'The Anchor of the Wall', job: 'Snaps to 1, then blocks GOD. Pulls and leads on Limo.', lineup: 'Over the ball. Drawn as the square.' },
  { label: 'G', kid: 'The Wall', job: 'Guards block GOD. One pulls on Limo.', lineup: 'One foot apart from the center.' },
  { label: 'T', kid: 'The Wall', job: 'Tackles block GOD. The wing-side tackle blocks OUT on Hammer.', lineup: 'One foot apart from the guard.' },
];

/** Gap, On, Down. The one blocking rule for the line on every run. */
export const GOD = {
  title: 'GOD: Gap, On, Down',
  steps: [
    { letter: 'G', word: 'Gap', ask: 'Is somebody in my inside gap (between me and the next blocker toward the ball)?', then: 'Block him. Protect your inside house first.' },
    { letter: 'O', word: 'On', ask: 'Nobody in my gap. Is somebody lined up on my nose?', then: 'Block him. Drive your face into his chest.' },
    { letter: 'D', word: 'Down', ask: 'Nobody in my gap and nobody on me?', then: 'Go Down the line toward the ball and block the first guy, or up to the linebacker. Seal inside, build the wall.' },
  ],
  inside: 'Inside always means toward the ball. The center\'s inside is the side the play goes. Nobody gets through your inside gap.',
  /** Same three letters on the passes, the D changes. */
  pass: [
    { letter: 'G', word: 'Gap', then: 'Somebody in my inside gap? Block him.' },
    { letter: 'O', word: 'On', then: 'Somebody on my nose? Block him.' },
    { letter: 'D', word: "Don't go downfield", then: 'Nobody there? Turn and help outside. Never go past the line on a pass.' },
  ],
  exceptions: [
    { word: 'OUT', who: 'Wing-side tackle on Hammer. F on Crossover and Boomerang.', means: 'Block the end man and push him to the outside.' },
    { word: 'PULL', who: 'Guard and center on Limo.', means: 'Step back, run flat behind the line. The guard kicks out the first man past the end. The center turns up and leads to the linebacker.' },
    { word: 'BLOCK BACK', who: 'Wing-side guard on Limo.', means: 'Block the man over the center so the center can pull. That is a Down block.' },
  ],
};

/** Hole numbers and gap letters, left to right as the offense sees it (Call Sheet + 2024 gap chart). */
export const HOLES = {
  rule: 'First number = who gets the ball (1, 2 or 4). Second number = the hole. Even numbers go right, odd numbers go left.',
  line: ['LT', 'LG', 'C', 'RG', 'RT'],
  gaps: ['C', 'B', 'A', 'A', 'B', 'C'],
  numbers: { left: [9, 7, 5, 3, 1], right: [0, 2, 4, 6, 8] },
};

export const LEGEND = [
  { mark: 'Red line with an arrow', means: 'The ball carrier.' },
  { mark: 'Black line with a T at the end', means: 'A block. The T is where you hit him.' },
  { mark: 'Black line with an arrow', means: 'A pass route, or a puller leading the way.' },
  { mark: 'Yellow glow', means: 'The first look on a pass.' },
  { mark: 'Dashed line', means: 'A fake, or where the ball is thrown.' },
  { mark: 'Square', means: 'The center.' },
];

export type InstallWeek = {
  week: number;
  title: string;
  /** Concept keys added this week. */
  adds: string[];
  /** Formations added this week. */
  formations: string[];
  line: string;
  skill: string;
  calling: string;
  drills: string[];
  /** Kids should be able to do or say these before you add the next week. */
  readyWhen: string[];
};

/**
 * Comfort-gated: a week's plays are not added until the team passes the last week's "ready when" checks.
 * A slow group stays on a week; nothing is lost because every later play reuses the same rules.
 */
export const INSTALL: InstallWeek[] = [
  {
    week: 1, title: 'Line up and run the Train', adds: ['train'], formations: ['beast-right', 'beast-left'],
    line: 'Stance (two-point first, then three-point). Splits: one foot apart. GOD step 1: Gap. Center to 1 snap, 20 a day.',
    skill: 'Where do I line up? Red and Yellow. 1 and 2 at 4 yards. Wings one yard back. Ball security: two hands in traffic.',
    calling: 'Huddle only. Coach says the color and number: "Red 1". Snap on Monday (first GO).',
    drills: ['Formation Freeze: coach yells Red or Yellow, players sprint to their spot and freeze', 'Door Run: 1 follows 2 through two bags', 'GOD walk-through: one defender, one blocker, coach points to a spot'],
    readyWhen: ['All 11 line up Red and Yellow in under 10 seconds', 'Every lineman can say G-O-D and point to his inside gap', 'Center to 1 snap is clean 8 out of 10'],
  },
  {
    week: 2, title: 'Hammer and Rocket', adds: ['hammer', 'rocket'], formations: [],
    line: 'GOD all three steps. The OUT block for the wing-side tackle on Hammer. On Rocket everybody seals inside.',
    skill: '1 reads the block on Hammer. On Rocket, run flat until the crease, then turn up. Wings: stalk block (hit and stay on).',
    calling: 'Wristband numbers 1 to 3. Hand signals for Train, Hammer, Rocket.',
    drills: ['Hole numbers: coach yells a number (14, 18), the runner points to the hole', 'Seal drill: wings and Y block down on a bag, 1 runs outside them', 'Two-for-one: two Trains, then a Hammer from the same look'],
    readyWhen: ['Runners can say even = right, odd = left', 'Wing-side tackle knows when he blocks OUT (Hammer only)', 'Team runs Train, Hammer, Rocket both colors without a jump'],
  },
  {
    week: 3, title: 'Crossover and Ice', adds: ['crossover', 'ice'], formations: [],
    line: 'Back side GOD: protect your inside gap, nobody chases. F learns the OUT block.',
    skill: '1: one jab step toward the wings, then cut back. 3 crosses and leads. 2 and 4 sell the fake for 5 yards.',
    calling: 'Saturday added (snap on SET). Ice: nobody moves, center snaps only if a defender jumps.',
    drills: ['Fake and freeze: 2 and 4 run Rocket, coach checks if the linebackers chased', 'Ice drill: coach jumps across, center snaps, 1 runs behind him. Everybody else stays frozen', 'Cadence game: coach says Monday or Saturday, line must go on the right word'],
    readyWhen: ['Nobody moves on Ice, 3 reps in a row', 'Team snaps on the right word for Monday and Saturday', 'Crossover from both colors with 3 leading the right way'],
  },
  {
    week: 4, title: 'First game week: clean up', adds: [], formations: [],
    line: 'Rep GOD against three fronts (even, odd, gap). Short yardage: Train with a lower pad level.',
    skill: 'Ball security circuit. Fumble recovery. 1 practices the snap in wet-ball conditions.',
    calling: 'Script the first 6 plays (see the call sheet). Assistant 1 tallies linebackers: chase, bite, or stay home.',
    drills: ['Scripted team period: the 6-play opening script', 'Watcher practice: one coach charts the scout team linebackers'],
    readyWhen: ['First 6 plays run with no penalties in practice', 'Every player can name his job on Train, Hammer, Rocket, Crossover'],
  },
  {
    week: 5, title: 'Limo (pullers)', adds: ['limo'], formations: [],
    line: 'Pulling: step back, run flat, eyes inside. Guard kicks out, center leads up. Wing-side guard blocks back.',
    skill: '2 takes the handoff going away from the wings and stays behind the center. 1 fakes to the wings.',
    calling: 'Limo is the answer when the defense shifts to the wings. Watch for the overshift.',
    drills: ['Pull race: guard and center pull on a whistle around cones', 'Handoff mesh: 1 to 2 going away, 20 reps each color'],
    readyWhen: ['Guard and center pull without running into each other', '2 can explain why Limo goes away from the wings'],
  },
  {
    week: 6, title: 'Magic (first pass)', adds: ['magic'], formations: [],
    line: 'Pass GOD: Gap, On, Don\'t go downfield. Sell the run for one step, then stay home.',
    skill: '1: Rocket fake, set the feet, look Y then F. Y: corner at 5 yards. F: post from the back side.',
    calling: 'Run-down rule: call Magic after Rocket worked, on a short-yardage down. Two Rockets, then Magic.',
    drills: ['Magic Trick: 1 and 2 hide the ball on the fake', 'Catch circuit: hands up early, eyes on the ball', 'No-downfield whistle: linemen freeze if they pass the line'],
    readyWhen: ['No lineman past the line on 5 Magic reps', '1 makes the throw or tucks and runs, no forced throws'],
  },
  {
    week: 7, title: 'No-huddle: check with me', adds: [], formations: [],
    line: 'Two-point ready stance until the call. Then get set.',
    skill: 'Everybody looks to the sideline after lining up.',
    calling: 'Check with me: "Beast Red, check with me". Then City + Color + Day ("Tyler Red Monday" = Train right on the first GO). Start with Train, Hammer, Rocket only. Add Friday (fake count).',
    drills: ['City game: coach says a city, players shout the play', 'Fast break: line up, look, set, snap in under 15 seconds'],
    readyWhen: ['Team runs 5 check-with-me plays in a row with no wrong play', 'Kids can say the play from any city or state word'],
  },
  {
    week: 8, title: 'Pop', adds: ['pop'], formations: ['beast-wide-right', 'beast-wide-left'],
    line: 'Quick pass set. Pass GOD.',
    skill: 'F: release fast, hands up, look for the ball. 1: throw on time, do not hold it. 2: flat route as the outlet.',
    calling: 'Pop on Saturday (quick snap). Beast Wide added: same plays, Y and the wings line up wide.',
    drills: ['Quick throw: F seam, 10 reps each side', 'Beast Wide alignment: Y on Hash +5'],
    readyWhen: ['F catches 7 of 10 seam throws', 'Team lines up Beast Wide both colors'],
  },
  {
    week: 9, title: 'Elevator and Boomerang', adds: ['elevator', 'boomerang'], formations: ['tank-right', 'tank-left'],
    line: 'Boomerang: sell Rocket, then cut off. Elevator: Pass GOD.',
    skill: 'Boomerang: 4 comes back for the ball, both hands. Elevator: look high (Y corner), then low (4 out).',
    calling: 'Boomerang when the defense chases Rocket and Crossover. Tank for short yardage and the goal line.',
    drills: ['Reverse exchange: 1 to 4, walk, jog, full speed', 'High-low read: coach covers Y or 4, 1 throws to the open one'],
    readyWhen: ['Clean reverse exchange 8 of 10', '1 can say the Elevator order: high, low, run'],
  },
  {
    week: 10, title: 'Pistol looks', adds: [], formations: ['pistol-right', 'pistol-left', 'pistol-slot'],
    line: 'Same GOD. Nothing new for the line.',
    skill: '1 at 3 yards, 2 behind him. Same plays, new picture.',
    calling: 'Use Pistol only if the team is comfortable. Otherwise stay in Beast and rep the best 6.',
    drills: ['Formation Freeze with all formations'],
    readyWhen: ['Team lines up every formation in under 10 seconds'],
  },
  {
    week: 11, title: 'Game plan polish', adds: [], formations: [],
    line: 'Short yardage and two-point plays. Fix the one block that broke last game.',
    skill: 'Two-minute: no-huddle with Saturday snaps.',
    calling: 'Tempo list and two-point list from the call sheet. Use the watcher tallies to pick plays.',
    drills: ['Two-minute drill', 'Two-point plays from the 3'],
    readyWhen: ['Team runs the tempo list without a huddle'],
  },
  {
    week: 12, title: 'Playoffs: our best 6', adds: [], formations: [],
    line: 'Rep only what we call. No new blocks.',
    skill: 'Ball security, every rep.',
    calling: 'Call sheet down to the best 6 plays plus Ice. Script the opener from what the watchers saw.',
    drills: ['Best 6, both colors, against the scout looks we expect'],
    readyWhen: ['Everyone knows the best 6 by name and color'],
  },
];

/** Call Sheet V3 sections, rewritten with the kid names. Entries are [side, concept key]. */
export type SheetEntry = [Side, string];
export const CALL_SHEET: { id: string; title: string; color: string; ink: string; rows: SheetEntry[] }[] = [
  { id: 'first10', title: 'First 10', color: '#000000', ink: '#ffffff', rows: [['right', 'hammer'], ['right', 'magic'], ['right', 'rocket'], ['right', 'elevator'], ['right', 'crossover'], ['right', 'limo'], ['right', 'pop'], ['right', 'boomerang'], ['right', 'ice'], ['left', 'hammer'], ['left', 'rocket']] },
  { id: 'misdirection', title: 'Misdirection', color: '#D0021B', ink: '#ffffff', rows: [['right', 'crossover'], ['right', 'limo'], ['right', 'boomerang'], ['left', 'limo'], ['left', 'crossover'], ['left', 'boomerang']] },
  { id: 'tempo', title: 'Tempo (no-huddle)', color: '#F28C28', ink: '#ffffff', rows: [['right', 'hammer'], ['right', 'magic'], ['right', 'rocket'], ['right', 'crossover'], ['right', 'pop'], ['left', 'hammer'], ['left', 'rocket']] },
  { id: 'playaction', title: 'Play action', color: '#FFD60A', ink: '#000000', rows: [['right', 'magic'], ['right', 'elevator'], ['right', 'pop'], ['left', 'magic'], ['left', 'elevator'], ['left', 'pop']] },
  { id: 'short', title: 'Short yardage', color: '#0E4D64', ink: '#ffffff', rows: [['right', 'hammer'], ['left', 'train'], ['left', 'limo'], ['right', 'train'], ['left', 'hammer'], ['left', 'ice']] },
  { id: 'long', title: 'Long yardage', color: '#1F6FB2', ink: '#ffffff', rows: [['right', 'magic'], ['right', 'rocket'], ['left', 'elevator'], ['left', 'pop'], ['left', 'boomerang'], ['left', 'rocket']] },
  { id: 'twopoint', title: 'Two-point', color: '#6B3FD6', ink: '#ffffff', rows: [['right', 'hammer'], ['right', 'magic'], ['left', 'crossover'], ['left', 'pop'], ['left', 'hammer']] },
];

/** The first 6 plays of every game: each one asks the defense a question (2nd/3rd grade guide, 4.1). */
export const SCRIPT: { entry: SheetEntry; asks: string }[] = [
  { entry: ['right', 'train'], asks: 'How fast do the linebackers fill the A gap?' },
  { entry: ['right', 'hammer'], asks: 'Does the end squeeze when the tackle blocks out?' },
  { entry: ['right', 'rocket'], asks: 'Who sets the edge? Do they overshift to the wings?' },
  { entry: ['right', 'crossover'], asks: 'Do the linebackers chase the Rocket fake?' },
  { entry: ['left', 'limo'], asks: 'Can we win away from the wings?' },
  { entry: ['right', 'magic'], asks: 'Do the safeties and corners bite on the Rocket fake?' },
];

/** Sideline IF / THEN, fed by the two watcher coaches. */
export const IF_THEN: { see: string; call: string[] }[] = [
  { see: 'Linebackers chase the Rocket fake or the wings', call: ['crossover', 'boomerang'] },
  { see: 'Defense shifts over to the wing side', call: ['limo', 'crossover'] },
  { see: 'Linebackers run downhill at the first step', call: ['magic', 'pop'] },
  { see: 'Ends line up wide, inside is soft', call: ['train', 'hammer'] },
  { see: 'Corner squeezes in, nobody outside', call: ['rocket', 'elevator'] },
  { see: 'Defense jumps on the count', call: ['ice'] },
];

export const WATCHERS = [
  { who: 'Assistant 1: linebackers', tally: ['Bites downhill on the first step (call Magic / Pop)', 'Chases the Rocket fake (call Crossover / Boomerang)', 'Stays home'] },
  { who: 'Assistant 2: edges and the back end', tally: ['Defense shifts to the wings (call Limo)', 'Corner squeezes in (call Rocket / Elevator)', 'Safety deeper than 7 yards'] },
];

export const PRACTICE_70 = [
  { time: '0:00 - 0:10', what: 'Formation Freeze: coach calls a color and a formation, everyone sprints to his spot and freezes.' },
  { time: '0:10 - 0:25', what: 'Line: stance, GOD, pulls. Backs: snaps, handoffs, ball security.' },
  { time: '0:25 - 0:45', what: 'Skill drills for this week\'s plays (Door Run, Magic Trick, Fake and Freeze).' },
  { time: '0:45 - 1:05', what: 'Team: this week\'s plays both colors, then the 6-play script.' },
  { time: '1:05 - 1:10', what: 'Check yourself: kids explain one play back to a coach in their own words.' },
];
