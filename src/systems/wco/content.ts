/**
 * Kid West Coast Offense 2026 (2nd / 3rd grade): the offense Sean McVay and Kyle Shanahan would build for their
 * own kids. Ten plays, same count as the Beast. The ideas are theirs, made small:
 * - one look for everything: the Pistol (Q at 3 yards, H straight behind him, F next to Q), Y on the color side;
 *   Bunch is the one look from the Gun;
 * - wide zone (Surf) is the play everything comes off: Dart, Cutback, Jet, Boot and Leak all look like Surf or
 *   Dart for the first two steps ("illusion of complexity");
 * - motion on purpose (Jet), naked bootleg off the run fake (Boot), a fullback who leads (Dart), the GT counter
 *   (Cutback), quick game from bunch (Hook), the back screen (Web) and mesh (Zipper);
 * - condensed splits (X on Hash +4, Z on Hash +3) so the blocks and throws stay short for 7 year olds.
 * Same language as the Beast: wristband number = play, Red / Yellow = side, play number = carrier + hole,
 * check-with-me = City + Color + Day.
 */
import type { CallSection, Concept, InstallWeek, SheetEntry } from '@/systems/youth/types';
import { CADENCE as BEAST_CADENCE, DAYS as BEAST_DAYS, GOD } from '@/systems/beast/content';

export const WCO_SYSTEM_ID = 'wco-2026';
export const WCO_ID_PREFIX = 'wco26-';
export const WCO_TAG = 'wco-2026';
export const WCO_PLAYBOOK_ID = 'wco26-playbook';

export const CADENCE = BEAST_CADENCE;
export const DAYS = BEAST_DAYS;

export const CONCEPTS: Concept[] = [
  {
    n: 1, key: 'surf', kid: 'Surf', coach: 'Wide Zone', kind: 'run', numbers: { right: 28, left: 29 },
    carrier: 'H', where: 'Outside, one cut: Bang, Bend or Bounce', withWings: true,
    kidSays: 'Everybody surfs the same way. H rides the wave and cuts up when he sees the hole.',
    signal: 'Arms out, surf the wave', cities: ['Sachse', 'South Carolina'], week: 1,
    coachNote: 'Wide zone, the play everything comes off. All eleven step to the call side. H aims for the edge and makes one cut: Bang (inside), Bend (at the Y) or Bounce (outside).',
  },
  {
    n: 2, key: 'dart', kid: 'Dart', coach: 'Duo / Lead', kind: 'run', numbers: { right: 22, left: 21 },
    carrier: 'H', where: 'A gap, right behind F', withWings: true,
    kidSays: 'F is the arrow, H is the dart. Throw it straight through the A gap.',
    signal: 'Throw a dart', cities: ['Dallas', 'Delaware'], week: 2,
    coachNote: 'Downhill run with the fullback leading, the Shanahan way. F crosses in front of H from his spot next to Q. The line blocks GOD with a double team at the point. Same first step as Leak.',
  },
  {
    n: 3, key: 'jet', kid: 'Jet', coach: 'Jet Sweep', kind: 'run', numbers: { right: 49, left: 48 },
    carrier: 'Z', where: 'Outside, AWAY from the Y', withWings: false,
    kidSays: 'Z flies across like a jet and takes the ball at full speed.',
    signal: 'Arms out like airplane wings', cities: ['Jacksonville', 'Jersey'], week: 3,
    coachNote: 'Jet motion, the McVay staple. Z gets the ball at full speed going away from the Y while H fakes Surf the other way. If they chase the motion, call Surf and Cutback back to the Y.',
  },
  {
    n: 4, key: 'cutback', kid: 'Cutback', coach: 'GT Counter', kind: 'run', numbers: { right: 26, left: 27 },
    carrier: 'H', where: 'Off tackle on the Y side, behind two pullers', withWings: true,
    kidSays: 'Step the wrong way, then cut back behind the two big pullers.',
    signal: 'Chop your hand back the other way', cities: ['Carrollton', 'Colorado'], week: 6,
    coachNote: "Shanahan's counter: the far guard kicks out, the far tackle leads, everybody else blocks back. H's first step sells Surf the other way.",
  },
  {
    n: 5, key: 'boot', kid: 'Boot', coach: 'Naked Boot', kind: 'pass', playAction: true, numbers: { right: 0, left: 0 },
    carrier: 'F, Y or X', where: 'Fake Surf, Q boots the other way', withWings: false,
    kidSays: 'Everybody goes one way. Q sneaks the ball the other way and throws to his buddies.',
    signal: 'Tap your shoe', cities: ['Bedford', 'Boston'], week: 5,
    coachNote: 'Naked bootleg off Surf: the play McVay and Shanahan build their pass game on. F fakes his Surf block on the end, then sneaks to the flat. Three receivers at three levels to the boot side: F low (flat), Y middle (cross), X high (clear). First look is the shortest throw.',
  },
  {
    n: 6, key: 'leak', kid: 'Leak', coach: 'Play-Action Leak', kind: 'pass', playAction: true, numbers: { right: 0, left: 0 },
    carrier: 'Y', where: 'Fake Dart, Y sneaks behind the linebackers', withWings: false,
    kidSays: 'We fake Dart. While everybody tackles H, Y leaks out behind them.',
    signal: 'Wiggle your fingers down like raindrops', cities: ['Lewisville', 'Louisiana'], week: 9,
    coachNote: 'Play action off Dart. The linebackers step up for the run, Y blocks for one count and leaks in behind them to the other side.',
  },
  {
    n: 7, key: 'hook', kid: 'Hook', coach: 'Stick', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'Y or F', where: 'Quick throw from bunch: Y hook, F flat', withWings: true,
    kidSays: 'Y hooks, F runs flat. Throw to whoever is open.',
    signal: 'Make a hook with your finger', cities: ['Houston', 'Hawaii'], week: 8,
    coachNote: 'Quick game: the Stick concept from Gun Bunch. Catch, one step, one read: the hook, then the flat.',
  },
  {
    n: 8, key: 'web', kid: 'Web', coach: 'Halfback Screen', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'H', where: 'Screen to H on the Y side', withWings: true,
    kidSays: 'The big guys make a spider web. H catches it and runs behind the web.',
    signal: 'Spread your fingers like a spider web', cities: ['Waco', 'Washington'], week: 9,
    coachNote: 'Halfback screen. Let the rushers come for two counts, then the center, guard and tackle slide out and make a web in front of H.',
  },
  {
    n: 9, key: 'zipper', kid: 'Zipper', coach: 'Mesh', kind: 'pass', numbers: { right: 0, left: 0 },
    carrier: 'X or Y', where: 'Two crossers zip past each other', withWings: true,
    kidSays: 'X and Y zip past each other like a zipper. Somebody always comes open.',
    signal: 'Zip up your jacket', cities: ['Zion', 'Zurich'], week: 10,
    coachNote: 'Mesh: two shallow crossers. Man coverage gets lost in the traffic, zone leaves a hole. Z clears deep, F is the outlet in the flat.',
  },
  {
    n: 10, key: 'ice', kid: 'Ice', coach: 'Freeze', kind: 'special', numbers: { right: 0, left: 0 },
    carrier: 'Q', where: 'Nobody moves', withWings: true,
    kidSays: 'Freeze! Nobody moves. If a defender jumps across, the center snaps it and Q runs right behind him.',
    signal: 'Hug yourself and shiver', cities: ['Irving', 'Iowa'], week: 3,
    coachNote: 'Freeze play to draw the defense offside. Run it on 4th and short or after a timeout.',
  },
];

export const conceptByKey = new Map(CONCEPTS.map((c) => [c.key, c]));

export const POSITIONS = [
  { label: 'Q', kid: 'The Captain', job: 'Catches the snap in the pistol (the gun on Bunch). Hands off, fakes, boots and throws. Number 1 in the play numbers.', lineup: 'Pistol: toes at 3 yards behind the center. Gun: 5 yards.' },
  { label: 'H', kid: 'The Runner', job: 'Carries Surf, Dart and Cutback. Fakes on everything else. Number 2.', lineup: 'Straight behind Q, toes at 5 1/2 yards. Next to Q in the gun.' },
  { label: 'F', kid: 'The Bulldozer', job: 'The fullback. Leads on Dart, seals the back side on Surf, sneaks to the flat on Boot. Number 3.', lineup: 'Next to Q on the side away from the Y.' },
  { label: 'Y', kid: 'The Anchor', job: 'Tight end. Wherever Y goes is the color side. Blocks, crosses on Boot, leaks on Leak.', lineup: 'On the line, next to the tackle on the color side.' },
  { label: 'Z', kid: 'Zoom', job: 'Receiver on the Y side. Goes in motion and carries Jet. Number 4.', lineup: 'Hash +3 on the Y side, one yard back.' },
  { label: 'X', kid: 'Lightning', job: 'Receiver on the other side. Runs deep to clear space, crosses on Zipper.', lineup: 'Hash +4 on the other side, on the line.' },
  { label: 'C', kid: 'Anchor of the Wall', job: 'Snaps to Q, then blocks. Slides out on Web.', lineup: 'Over the ball. Drawn as the square.' },
  { label: 'G', kid: 'The Wall', job: 'Guards. The far guard pulls and kicks out on Cutback.', lineup: 'One foot from the center.' },
  { label: 'T', kid: 'The Wall', job: 'Tackles. The far tackle pulls and leads on Cutback.', lineup: 'One foot from the guard.' },
];

export const ZONE_RULE = {
  key: 'zone',
  title: 'STEP-HIT-UP (zone)',
  usedOn: 'Surf, Jet, and the Surf fake on Boot',
  steps: [
    { letter: 'S', word: 'Step', ask: 'Big first step to the side of the play.', then: 'Every lineman steps the same way at the same time, like a wave.' },
    { letter: 'H', word: 'Hit', ask: 'Somebody in front of you, or in the gap you stepped into?', then: 'Hit him and run your feet. Push him toward the sideline.' },
    { letter: 'U', word: 'Up', ask: 'Nobody there?', then: 'Keep going up to the linebacker.' },
  ],
};

export const BLOCKING = {
  rules: [
    ZONE_RULE,
    { key: 'god', title: GOD.title, usedOn: 'Dart, Cutback, and the Dart fake on Leak', steps: GOD.steps },
    { key: 'pass', title: 'Pass GOD', usedOn: 'Boot, Leak, Hook, Web, Zipper', steps: GOD.pass },
  ],
  inside: 'On GOD plays, inside means toward the ball. On STEP-HIT-UP plays everybody steps to the play, so nobody gets across your face.',
  exceptions: [
    { word: 'PULL', who: 'Far guard and far tackle on Cutback', means: 'Step back, run flat behind the line. The guard kicks out the first man past the Y. The tackle turns up and leads to the linebacker.' },
    { word: 'BLOCK BACK', who: 'Center and the Y-side linemen on Cutback', means: 'Block down toward where the pullers left, so nobody chases.' },
    { word: 'WEB', who: 'Center, Y-side guard and tackle on Web', means: 'Block for two counts, let him come, then slide to the screen side behind the line and block the first color you see.' },
  ],
};

export const LEGEND = [
  { mark: 'Red line with an arrow', means: 'The ball carrier.' },
  { mark: 'Black line with a T at the end', means: 'A block. The T is where you hit him.' },
  { mark: 'Black line with an arrow', means: 'A pass route, or a puller leading the way.' },
  { mark: 'Yellow glow', means: 'The first look on a pass.' },
  { mark: 'Dashed black line', means: 'A fake.' },
  { mark: 'Dashed red line', means: 'Where the ball is thrown.' },
  { mark: 'Faded circle and dotted line', means: 'Where a player starts before his motion.' },
];

export const INSTALL: InstallWeek[] = [
  {
    week: 1, title: 'Line up and Surf', adds: ['surf'], formations: ['pistol-right', 'pistol-left'],
    line: 'Stance and splits (one foot). STEP-HIT-UP: everybody steps together. Pistol snap from the center to Q at 3 yards, 20 a day.',
    skill: 'Pistol Red and Pistol Yellow: who goes where. Q catches the snap and puts the ball in H\'s belly as H runs by. H: one cut (Bang, Bend, Bounce).',
    calling: 'Huddle only. "Red 1" = Surf to the Red side. Snap on Monday.',
    drills: ['Formation Freeze: coach yells Red or Yellow, everyone sprints to his spot', 'Wave drill: the line steps together on the snap, five in a row', 'Bang-Bend-Bounce: three cones, coach points, H cuts'],
    readyWhen: ['All 11 line up Pistol Red and Pistol Yellow in under 10 seconds', 'The line takes the same first step on every snap', 'Pistol snap is clean 8 out of 10 (chest high, no bounces)'],
  },
  {
    week: 2, title: 'Dart', adds: ['dart'], formations: [],
    line: 'GOD (Gap, On, Down) for Dart. Know which rule: STEP-HIT-UP on Surf, GOD on Dart.',
    skill: 'F leads through the A gap. H follows F. Q hands off and fakes the boot every time.',
    calling: 'Wristband 1 and 2. Hand signals for Surf and Dart.',
    drills: ['Rule call-out: coach says Surf or Dart, linemen shout STEP-HIT-UP or GOD', 'Door Run: H follows F through two bags'],
    readyWhen: ['Every lineman knows which rule goes with Surf and with Dart', 'F hits the linebacker square on 5 Dart reps'],
  },
  {
    week: 3, title: 'Jet and Ice', adds: ['jet', 'ice'], formations: [],
    line: 'STEP-HIT-UP to the other side on Jet. Ice: nobody moves.',
    skill: 'Z jet motion: full speed, in front of Q. Snap when Z reaches the guard. Q steps up, hands to Z on the run, then fakes Surf to H.',
    calling: 'Saturday added (snap on SET). Jet is always on Monday at first so the timing stays the same.',
    drills: ['Jet timing: Z runs motion, Q claps, snap at the guard, 10 reps a side', 'Ice drill: coach jumps, only the center can snap'],
    readyWhen: ['Clean Jet handoff 8 of 10 at full speed', 'Nobody moves on Ice, 3 reps in a row'],
  },
  {
    week: 4, title: 'First game week: clean up', adds: [], formations: [],
    line: 'Rep STEP-HIT-UP and GOD against three fronts. Short yardage: Dart with low pad level.',
    skill: 'Ball security circuit. Every fake looks like the real play.',
    calling: 'Script the first 6 plays (call sheet). Assistant 1 tallies linebackers: do they flow with Surf?',
    drills: ['Scripted team period: the 6-play opening script', 'Fake check: coach watches Q and H on every fake'],
    readyWhen: ['First 6 plays run with no penalties in practice', 'Every player can say his job on Surf, Dart and Jet'],
  },
  {
    week: 5, title: 'Boot (first pass)', adds: ['boot'], formations: [],
    line: 'Sell Surf with the STEP, then Pass GOD: Gap, On, Don\'t go downfield.',
    skill: 'Q: Surf fake, hide the ball on the hip, boot out. Look LOW (F flat), MIDDLE (Y cross), then run. F sneaks out late, Y blocks one count then crosses.',
    calling: 'Two-for-one: two Surfs, then Boot. Call it when the back side end chases Surf.',
    drills: ['Hide the ball: Q and H fake Surf, coach guesses who has it', 'Boot throw: rolling throw to the flat, 10 a side'],
    readyWhen: ['No lineman past the line on 5 Boot reps', 'Q throws on the run or tucks it, no forced throws'],
  },
  {
    week: 6, title: 'Cutback (pullers)', adds: ['cutback'], formations: [],
    line: 'Pulling: far guard kicks out, far tackle leads. Everybody else blocks back.',
    skill: 'H: one step the Surf way, then cut back behind the pullers. Q hands off and fakes the boot.',
    calling: 'Call Cutback when the linebackers run with Surf.',
    drills: ['Pull race: guard and tackle pull on a whistle around cones', 'Cutback step: H steps the wrong way, plants, follows the pullers'],
    readyWhen: ['Guard and tackle pull without running into each other', 'H can explain why the first step goes the wrong way'],
  },
  {
    week: 7, title: 'No-huddle: check with me', adds: [], formations: [],
    line: 'Two-point ready stance until the call, then get set.',
    skill: 'Everybody looks to the sideline after lining up.',
    calling: '"Pistol Red, check with me!" then City + Color + Day ("Sachse Red Monday" = Surf right on the first GO). Start with Surf, Dart, Jet. Add Friday (fake count).',
    drills: ['City game: coach says a city, players shout the play', 'Fast break: line up, look, set, snap in under 15 seconds'],
    readyWhen: ['Five check-with-me plays in a row with no wrong play'],
  },
  {
    week: 8, title: 'Hook from Gun Bunch', adds: ['hook'], formations: ['gun-bunch-right', 'gun-bunch-left'],
    line: 'Quick pass set. Pass GOD. Gun snap: 5 yards, chest high.',
    skill: 'Gun Bunch: Q at 5 yards, H next to him. Z in front on the line, Y and F one step back on each side of him. Y hooks at 5, F to the flat, Z clears deep. Q: catch, one step, throw on time.',
    calling: 'Hook on Saturday (quick snap). Good on 3rd and short.',
    drills: ['Gun snaps: 20 a day from 5 yards', 'Bunch line-up: Red and Yellow, 10 seconds', 'Hook-flat read: coach covers one, Q throws the other'],
    readyWhen: ['Team lines up Gun Bunch both colors', 'Gun snap is clean 8 out of 10', 'Y catches 7 of 10 hooks'],
  },
  {
    week: 9, title: 'Leak and Web', adds: ['leak', 'web'], formations: [],
    line: 'Leak: sell Dart (GOD) for one step, then Pass GOD. Web: block two counts, then slide out.',
    skill: 'Leak: Y blocks one count, then sneaks across behind the linebackers. Web: H fakes a block, slides to the Y side, catches, follows the web.',
    calling: 'Leak after two Darts. Web when they blitz.',
    drills: ['Leak timing: one-thousand-one, release', 'Web race: linemen slide out and set the web before H catches it'],
    readyWhen: ['Y releases on time 4 of 5', 'The web is set before the catch'],
  },
  {
    week: 10, title: 'Zipper and Ace', adds: ['zipper'], formations: ['pistol-ace-right', 'pistol-ace-left'],
    line: 'Pass GOD. Ace: two tight ends, same rules.',
    skill: 'X crosses under at 4, Y over at 6: they zip past each other. Z clears deep, F to the flat.',
    calling: 'Zipper against man coverage. Ace for the same runs with two tight ends.',
    drills: ['Zipper: X and Y high-five as they cross', 'Ace line-up: F becomes the second tight end'],
    readyWhen: ['X and Y cross without running into each other', 'Team lines up Ace both colors'],
  },
  {
    week: 11, title: 'Jumbo, red zone and two-point', adds: [], formations: ['pistol-jumbo'],
    line: 'Short yardage: Dart and Cutback from Jumbo. Low pad level.',
    skill: 'Two-minute: no-huddle with Saturday snaps.',
    calling: 'Two-point list from the call sheet. Use the watcher tallies to pick plays.',
    drills: ['Goal line: Dart and Cutback from the 3', 'Two-minute drill'],
    readyWhen: ['Team runs the tempo list without a huddle'],
  },
  {
    week: 12, title: 'Playoffs: our best 6', adds: [], formations: [],
    line: 'Rep only what we call. No new blocks.',
    skill: 'Ball security and fakes, every rep.',
    calling: 'Call sheet down to the best 6 plus Ice. Script the opener from what the watchers saw.',
    drills: ['Best 6, both colors, against the scout looks we expect'],
    readyWhen: ['Everyone knows the best 6 by name and color'],
  },
];

export const CALL_SHEET: CallSection[] = [
  { id: 'first10', title: 'First 10', color: '#000000', ink: '#ffffff', rows: [['right', 'surf'], ['right', 'dart'], ['left', 'surf'], ['right', 'jet'], ['right', 'boot'], ['right', 'cutback'], ['right', 'hook'], ['left', 'dart'], ['right', 'leak'], ['left', 'boot']] },
  { id: 'surf-series', title: 'Surf series (same look)', color: '#0E4D64', ink: '#ffffff', rows: [['right', 'surf'], ['right', 'cutback'], ['right', 'boot'], ['right', 'jet'], ['left', 'surf'], ['left', 'cutback'], ['left', 'boot'], ['left', 'jet']] },
  { id: 'tempo', title: 'Tempo (no-huddle)', color: '#F28C28', ink: '#ffffff', rows: [['right', 'surf'], ['right', 'hook'], ['right', 'jet'], ['left', 'surf'], ['left', 'hook'], ['right', 'zipper']] },
  { id: 'playaction', title: 'Play action', color: '#FFD60A', ink: '#000000', rows: [['right', 'boot'], ['right', 'leak'], ['left', 'boot'], ['left', 'leak'], ['right', 'web']] },
  { id: 'quick', title: 'Quick game & screens', color: '#1F6FB2', ink: '#ffffff', rows: [['right', 'hook'], ['right', 'zipper'], ['right', 'web'], ['left', 'hook'], ['left', 'zipper'], ['left', 'web']] },
  { id: 'short', title: 'Short yardage', color: '#D0021B', ink: '#ffffff', rows: [['right', 'dart'], ['left', 'dart'], ['right', 'cutback'], ['right', 'surf'], ['left', 'ice']] },
  { id: 'twopoint', title: 'Two-point', color: '#6B3FD6', ink: '#ffffff', rows: [['right', 'boot'], ['left', 'dart'], ['right', 'hook'], ['right', 'zipper'], ['left', 'cutback']] },
];

export const SCRIPT: { entry: SheetEntry; asks: string }[] = [
  { entry: ['right', 'surf'], asks: 'Who sets the edge? Do the linebackers run with it?' },
  { entry: ['right', 'dart'], asks: 'How fast do the linebackers fill the A gap?' },
  { entry: ['right', 'jet'], asks: 'Does anybody run with the Jet motion?' },
  { entry: ['right', 'cutback'], asks: 'Did the far linebacker chase Surf?' },
  { entry: ['right', 'boot'], asks: 'Does the far end crash on the Surf fake?' },
  { entry: ['right', 'hook'], asks: 'Where are the short defenders on the Y side?' },
];

export const IF_THEN: { see: string; call: string[] }[] = [
  { see: 'Linebackers run hard with Surf', call: ['cutback', 'boot'] },
  { see: 'The far end crashes on the Surf fake', call: ['boot', 'jet'] },
  { see: 'Defense chases the Jet motion', call: ['surf', 'cutback'] },
  { see: 'Linebackers run downhill at the first step', call: ['leak', 'boot'] },
  { see: 'Defense blitzes or rushes hard', call: ['web', 'hook'] },
  { see: 'Corners play far off the line', call: ['hook', 'zipper'] },
  { see: 'Defense jumps on the count', call: ['ice'] },
];

export const WATCHERS = [
  { who: 'Assistant 1: linebackers', tally: ['Runs with Surf (call Cutback / Boot)', 'Bites downhill on Dart (call Leak)', 'Chases the Jet motion (call Surf / Cutback)'] },
  { who: 'Assistant 2: edges and the back end', tally: ['Far end crashes on the fake (call Boot)', 'Corners play off (call Hook / Zipper)', 'Blitzes (call Web)'] },
];

export const PRACTICE_70 = [
  { time: '0:00 - 0:10', what: 'Formation Freeze: coach calls a color and a formation, everyone sprints to his spot and freezes.' },
  { time: '0:10 - 0:25', what: 'Line: stance, the wave (STEP-HIT-UP), GOD, pulls. Backs: pistol and gun snaps, handoffs, fakes.' },
  { time: '0:25 - 0:45', what: 'Skill drills for this week\'s plays (Bang-Bend-Bounce, Jet timing, Hide the ball).' },
  { time: '0:45 - 1:05', what: 'Team: this week\'s plays both colors, then the 6-play script.' },
  { time: '1:05 - 1:10', what: 'Check yourself: kids explain one play back to a coach in their own words.' },
];

export const CHECK_THESE = [
  { label: 'Two run rules', text: 'STEP-HIT-UP (zone) on Surf and Jet, GOD on Dart and Cutback, Pass GOD on every pass. If two rules is too much early, block Surf with GOD for the first two weeks; the picture is the same.' },
  { label: 'Pistol, not under center', text: 'Q catches the snap at 3 yards and H stays straight behind him, so every run and fake still starts the same way (the McVay / Shanahan idea) without the under-center exchange. Bunch comes from the Gun so Q sees the hook right away. The pistol snap needs daily reps: 20 a practice.' },
  { label: 'F next to Q', text: 'in the pistol F starts beside Q on the side away from the Y. He leads across on Dart, seals the back side on Surf and fakes that same seal before sneaking to the flat on Boot.' },
  { label: 'Jet and Boot go away from the Y', text: 'on purpose. Everything looks like Surf, then the ball goes the other way. That is the whole idea of their offense.' },
  { label: 'Condensed splits', text: 'X on Hash +4 and Z on Hash +3 (NFL field level) keep blocks and throws short for 7 year olds. Widen them if your field is narrow.' },
  { label: 'Boot first look', text: 'is the flat (the shortest throw), then the cross. McVay often reads cross first; for 7 year olds the flat is the safer throw.' },
  { label: 'Numbers', text: '1 = Q, 2 = H, 3 = F, 4 = a receiver. 28 Surf = H to hole 8, 49 Jet = Z to hole 9.' },
];

export type { SheetEntry };
