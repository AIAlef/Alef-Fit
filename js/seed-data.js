/* Alef.Fit — starter exercise library (72 exercises).
   n=name, c=categoryId, m=muscles, s=technique steps.
   Media intentionally empty — user adds own photos/videos (copyright-safe). */
'use strict';

var SEED_EXERCISES = [
/* ---- Chest ---- */
{ n: 'Barbell Bench Press', c: 'chest', m: ['Pectoralis Major', 'Triceps', 'Anterior Deltoid'], s: ['Lie on flat bench, grip bar slightly wider than shoulders, feet planted.', 'Lower bar to mid-chest with elbows ~45°, keep shoulder blades pinched.', 'Press up to full lockout without bouncing off the chest.'] },
{ n: 'Incline Dumbbell Press', c: 'chest', m: ['Upper Pectoralis', 'Anterior Deltoid', 'Triceps'], s: ['Set bench to 30–45°. Start dumbbells at shoulder level, palms forward.', 'Press up and slightly inward until arms are extended.', 'Lower under control to a deep but pain-free stretch.'] },
{ n: 'Dumbbell Flys', c: 'chest', m: ['Pectoralis Major'], s: ['Lie flat, dumbbells above chest with a slight elbow bend.', 'Open arms in a wide arc until you feel a chest stretch.', 'Squeeze the chest to bring the weights back together.'] },
{ n: 'Cable Crossover Flys', c: 'chest', m: ['Pectoralis Major (inner)', 'Anterior Deltoid'], s: ['Set pulleys high, step forward with a slight lean.', 'Pull handles down and together in front of hips.', 'Control the return, keeping constant tension.'] },
{ n: 'Push-Ups', c: 'chest', m: ['Pectoralis Major', 'Triceps', 'Core'], s: ['Hands slightly wider than shoulders, body in a straight line.', 'Lower chest to just above the floor, elbows ~45°.', 'Push back up without letting hips sag.'] },
{ n: 'Parallel Bar Dips (Chest)', c: 'chest', m: ['Lower Pectoralis', 'Triceps', 'Anterior Deltoid'], s: ['Grip bars, lean torso forward ~30°, knees tucked.', 'Lower until upper arms are parallel to the floor.', 'Press up while keeping the forward lean to load the chest.'] },
{ n: 'Dumbbell Pullovers', c: 'chest', m: ['Pectoralis Major', 'Lats', 'Serratus'], s: ['Lie across a bench, hold one dumbbell above chest with both hands.', 'Lower it in an arc behind your head until you feel a stretch.', 'Pull back over the chest using chest and lats.'] },
{ n: 'Machine Chest Press', c: 'chest', m: ['Pectoralis Major', 'Triceps'], s: ['Adjust seat so handles are at mid-chest height.', 'Press handles forward to full extension.', 'Return slowly until elbows pass slightly behind torso.'] },

/* ---- Back ---- */
{ n: 'Pull-Ups', c: 'back', m: ['Lats', 'Biceps', 'Mid Traps'], s: ['Hang from bar, grip slightly wider than shoulders.', 'Pull chest toward the bar, driving elbows down.', 'Lower with control to a full hang.'] },
{ n: 'Lat Pulldown', c: 'back', m: ['Lats', 'Biceps', 'Rear Deltoid'], s: ['Grip bar wide, sit with thighs secured.', 'Pull bar to upper chest while squeezing shoulder blades.', 'Return slowly to full arm extension.'] },
{ n: 'Barbell Bent-Over Row', c: 'back', m: ['Lats', 'Rhomboids', 'Erector Spinae'], s: ['Hinge at hips ~45°, back flat, bar hanging at knees.', 'Row bar to lower ribs, elbows close to body.', 'Lower under control without rounding the back.'] },
{ n: 'Seated Cable Row', c: 'back', m: ['Mid Back', 'Lats', 'Biceps'], s: ['Sit tall, knees soft, grab the close-grip handle.', 'Pull to the stomach, chest up, squeeze the blades.', 'Let arms extend fully without slumping forward.'] },
{ n: 'One-Arm Dumbbell Row', c: 'back', m: ['Lats', 'Rhomboids'], s: ['Knee and hand on bench, back flat, dumbbell hanging.', 'Row to the hip, elbow brushing the ribs.', 'Lower slowly; avoid rotating the torso.'] },
{ n: 'Deadlift', c: 'back', m: ['Erector Spinae', 'Glutes', 'Hamstrings', 'Traps'], s: ['Bar over mid-foot, grip outside knees, flat back.', 'Drive through the floor, keep the bar close, stand tall.', 'Hinge back down under control.'] },
{ n: 'Face Pulls', c: 'back', m: ['Rear Deltoid', 'Mid Traps', 'Rotator Cuff'], s: ['Set rope at face height, grip with thumbs back.', 'Pull toward the face, elbows high and wide.', 'Pause, then return with control.'] },
{ n: 'Back Extensions', c: 'back', m: ['Erector Spinae', 'Glutes'], s: ['Set hips on the pad, ankles locked.', 'Lower torso until a light hamstring stretch.', 'Raise to a straight line — do not hyperextend.'] },

/* ---- Leg (incl. calf) ---- */
{ n: 'Barbell Back Squat', c: 'leg', m: ['Quadriceps', 'Glutes', 'Hamstrings'], s: ['Bar on upper traps, feet shoulder-width, toes slightly out.', 'Sit down and back until thighs reach parallel or below.', 'Drive up through mid-foot, knees tracking over toes.'] },
{ n: 'Leg Press', c: 'leg', m: ['Quadriceps', 'Glutes'], s: ['Feet shoulder-width on the platform.', 'Lower until knees near 90° without lifting the lower back.', 'Press up without locking the knees hard.'] },
{ n: 'Romanian Deadlift', c: 'leg', m: ['Hamstrings', 'Glutes', 'Erector Spinae'], s: ['Hold bar at hips, knees slightly bent.', 'Hinge hips back, bar sliding down the thighs.', 'Stop at hamstring stretch, then drive hips forward.'] },
{ n: 'Walking Lunges', c: 'leg', m: ['Quadriceps', 'Glutes'], s: ['Step forward and lower the back knee toward the floor.', 'Keep front knee over the ankle, torso upright.', 'Push off and step through with the other leg.'] },
{ n: 'Leg Extension', c: 'leg', m: ['Quadriceps'], s: ['Sit with shins behind the pad, knees aligned with the pivot.', 'Extend legs to full lockout, squeeze the quads.', 'Lower slowly without letting the stack slam.'] },
{ n: 'Lying Leg Curl', c: 'leg', m: ['Hamstrings'], s: ['Lie prone, pad above the heels.', 'Curl heels toward the glutes.', 'Return slowly to almost straight.'] },
{ n: 'Hip Thrust', c: 'leg', m: ['Glutes', 'Hamstrings'], s: ['Upper back on bench, bar over hips, feet flat.', 'Drive hips up until torso is level, squeeze glutes.', 'Lower a few inches and repeat.'] },
{ n: 'Standing Calf Raise', c: 'leg', m: ['Gastrocnemius'], s: ['Balls of feet on the edge, heels hanging.', 'Rise as high as possible onto the toes.', 'Lower to a deep stretch — slow tempo.'] },
{ n: 'Seated Calf Raise', c: 'leg', m: ['Soleus'], s: ['Sit with pad on the knees, balls of feet on the block.', 'Raise heels through the full range.', 'Pause at top and bottom stretch.'] },
{ n: 'Bulgarian Split Squat', c: 'leg', m: ['Quadriceps', 'Glutes'], s: ['Rear foot on a bench, front foot ~60 cm ahead.', 'Lower straight down until the front thigh is parallel.', 'Drive up through the front heel.'] },

/* ---- Shoulder ---- */
{ n: 'Overhead Barbell Press', c: 'shoulder', m: ['Deltoids', 'Triceps', 'Upper Chest'], s: ['Bar at collarbone, grip just outside shoulders.', 'Press overhead, moving head slightly back then through.', 'Lower under control to the collarbone.'] },
{ n: 'Seated Dumbbell Press', c: 'shoulder', m: ['Deltoids', 'Triceps'], s: ['Sit upright, dumbbells at shoulder height, palms forward.', 'Press up until arms are extended overhead.', 'Lower with control to ear level.'] },
{ n: 'Lateral Raises', c: 'shoulder', m: ['Lateral Deltoid'], s: ['Stand tall, dumbbells at the sides, slight elbow bend.', 'Raise out to the sides to shoulder height, wrists neutral.', 'Lower slowly — no swinging.'] },
{ n: 'Front Raises', c: 'shoulder', m: ['Anterior Deltoid'], s: ['Hold dumbbells in front of the thighs.', 'Raise one or both arms to shoulder height.', 'Lower under control; keep the torso still.'] },
{ n: 'Dumbbell Rear Deltoid Raises', c: 'shoulder', m: ['Rear Deltoid', 'Mid Traps'], s: ['Hinge forward, back flat, dumbbells hanging.', 'Raise arms out to the sides, leading with elbows.', 'Squeeze the rear delts, then lower slowly.'] },
{ n: 'Upright Row', c: 'shoulder', m: ['Lateral Deltoid', 'Traps'], s: ['Grip bar/dumbbells at thigh, hands shoulder-width.', 'Pull up along the body to chest height, elbows high.', 'Lower with control; stop if shoulders pinch.'] },
{ n: 'Barbell Shrugs', c: 'shoulder', m: ['Upper Traps'], s: ['Hold bar at hips with straight arms.', 'Shrug shoulders straight up toward the ears.', 'Pause, then lower fully — no rolling.'] },

/* ---- Bicep (incl. forearm flexors) ---- */
{ n: 'Barbell Curl', c: 'bicep', m: ['Biceps Brachii'], s: ['Stand tall, grip bar shoulder-width, elbows at the sides.', 'Curl to shoulder height without swinging.', 'Lower slowly to full extension.'] },
{ n: 'Dumbbell Alternating Curl', c: 'bicep', m: ['Biceps Brachii'], s: ['Palms up, curl one dumbbell while the other stays down.', 'Squeeze at the top, lower with control.', 'Alternate arms, torso still.'] },
{ n: 'Hammer Curls', c: 'bicep', m: ['Brachialis', 'Brachioradialis'], s: ['Neutral grip (palms facing in).', 'Curl to the shoulder keeping the wrist neutral.', 'Lower slowly and repeat.'] },
{ n: 'Preacher Curls', c: 'bicep', m: ['Biceps (short head)'], s: ['Arms on the preacher pad, armpits on top edge.', 'Curl the bar up without lifting the elbows.', 'Lower to near-full extension under control.'] },
{ n: 'Incline Dumbbell Curl', c: 'bicep', m: ['Biceps (long head)'], s: ['Lie back on a 45–60° incline, arms hanging.', 'Curl both dumbbells without moving the upper arms.', 'Lower to a full stretch.'] },
{ n: 'Concentration Curl', c: 'bicep', m: ['Biceps Brachii'], s: ['Seated, elbow braced on the inner thigh.', 'Curl to the shoulder with a supinated grip.', 'Lower slowly; keep the upper arm still.'] },
{ n: 'Wrist Curls (Flexors)', c: 'bicep', m: ['Forearm Flexors'], s: ['Forearms on a bench, palms up, wrists off the edge.', 'Let the bar roll to the fingers, then curl the wrists up.', 'Lower slowly through the full range.'] },

/* ---- Triceps (incl. forearm extensors) ---- */
{ n: 'Close-Grip Bench Press', c: 'triceps', m: ['Triceps', 'Chest', 'Anterior Deltoid'], s: ['Grip the bar shoulder-width, elbows tucked.', 'Lower to the lower chest, forearms vertical.', 'Press up, focusing on the triceps.'] },
{ n: 'Cable Rope Pushdown', c: 'triceps', m: ['Triceps'], s: ['Elbows pinned to the sides, rope at chest height.', 'Push down and split the rope at the bottom.', 'Return until forearms pass parallel — elbows still.'] },
{ n: 'Overhead Dumbbell Extension', c: 'triceps', m: ['Triceps (long head)'], s: ['Hold one dumbbell overhead with both hands.', 'Lower behind the head until forearms touch biceps.', 'Extend back to lockout, elbows pointing forward.'] },
{ n: 'Skull Crushers', c: 'triceps', m: ['Triceps'], s: ['Lie flat, bar above the chest with a narrow grip.', 'Bend elbows to lower the bar toward the forehead.', 'Extend back up without flaring the elbows.'] },
{ n: 'Parallel Bar Dips (Triceps)', c: 'triceps', m: ['Triceps', 'Lower Chest'], s: ['Torso upright, elbows pointing back.', 'Lower until elbows reach ~90°.', 'Press to full lockout.'] },
{ n: 'Triceps Kickback', c: 'triceps', m: ['Triceps'], s: ['Hinge forward, upper arm parallel to the floor.', 'Extend the forearm straight back to lockout.', 'Pause, then return without dropping the elbow.'] },
{ n: 'Reverse Wrist Curls (Extensors)', c: 'triceps', m: ['Forearm Extensors'], s: ['Forearms on a bench, palms down, wrists off the edge.', 'Raise the knuckles upward as far as possible.', 'Lower slowly; use light weight.'] },

/* ---- Abs ---- */
{ n: 'Crunches', c: 'abs', m: ['Rectus Abdominis'], s: ['Lie down, knees bent, hands by the temples.', 'Curl shoulders off the floor, ribs toward the pelvis.', 'Lower slowly without pulling the neck.'] },
{ n: 'Sit-Ups', c: 'abs', m: ['Rectus Abdominis', 'Hip Flexors'], s: ['Lie down, knees bent, feet anchored if needed.', 'Sit all the way up, exhaling at the top.', 'Lower with control, vertebra by vertebra.'] },
{ n: 'Incline Bench Sit-Ups', c: 'abs', m: ['Rectus Abdominis'], s: ['Lie back on the decline bench, hands overhead or crossed. Knees bent.', 'Raise the upper body while keeping the lower back on the bench. Hold one second.', 'Return to the starting position under control.'] },
{ n: 'Hanging Leg Raises', c: 'abs', m: ['Lower Abs', 'Hip Flexors'], s: ['Hang from a bar, shoulders active.', 'Raise legs to hip height (or knees to chest).', 'Lower slowly without swinging.'] },
{ n: 'Leg Raises', c: 'abs', m: ['Lower Abs'], s: ['Lie flat, hands under the hips.', 'Raise straight legs to vertical.', 'Lower until just above the floor, no arching.'] },
{ n: 'Plank', c: 'abs', m: ['Core', 'Transverse Abdominis'], s: ['Forearms down, body in a straight line.', 'Brace abs and glutes; do not let hips sag.', 'Hold for the target time while breathing steadily.'] },
{ n: 'Russian Twists', c: 'abs', m: ['Obliques'], s: ['Sit, lean back ~45°, feet up or lightly touching.', 'Rotate the torso side to side, touching the floor.', 'Keep the chest tall throughout.'] },
{ n: 'Dumbbell Side Bends', c: 'abs', m: ['Obliques', 'QL'], s: ['Stand tall with a dumbbell in one hand.', 'Bend sideways toward the weight, then pull back upright using the opposite oblique.', 'Complete the reps, then switch sides.'] },

/* ---- Compound ---- */
{ n: 'Clean and Press', c: 'compound', m: ['Full Body', 'Shoulders', 'Legs'], s: ['Pull the bar from the floor to the shoulders in one motion.', 'Dip slightly and press overhead to lockout.', 'Lower to the shoulders, then to the floor.'] },
{ n: 'Kettlebell Swing', c: 'compound', m: ['Glutes', 'Hamstrings', 'Core'], s: ['Hinge and hike the bell back between the legs.', 'Snap the hips forward — the bell floats to chest height.', 'Let it swing back and repeat rhythmically.'] },
{ n: 'Thruster', c: 'compound', m: ['Quadriceps', 'Shoulders', 'Core'], s: ['Front squat down with the bar/dumbbells racked.', 'Drive up and use the momentum to press overhead.', 'Lower back to the rack position and repeat.'] },
{ n: 'Farmer’s Carry', c: 'compound', m: ['Grip', 'Traps', 'Core'], s: ['Deadlift heavy weights at your sides.', 'Walk tall with short quick steps for the target distance.', 'Keep shoulders back; do not lean.'] },
{ n: 'Bear Crawl', c: 'compound', m: ['Core', 'Shoulders', 'Quads'], s: ['On hands and toes, knees hovering an inch up.', 'Crawl forward moving opposite hand and foot.', 'Keep hips level and steps small.'] },
{ n: 'Burpees', c: 'compound', m: ['Full Body'], s: ['Squat, kick back to a push-up, chest to the floor.', 'Snap the feet back in and jump up with arms overhead.', 'Land soft and flow into the next rep.'] },

/* ---- Functional ---- */
{ n: 'Box Jumps', c: 'functional', m: ['Legs', 'Power'], s: ['Stand a short step from the box.', 'Swing arms and jump, landing soft with both feet.', 'Stand tall, then step (not jump) down.'] },
{ n: 'Battle Ropes', c: 'functional', m: ['Shoulders', 'Core', 'Conditioning'], s: ['Athletic stance, one rope end per hand.', 'Make fast alternating waves for the interval.', 'Keep knees bent and core braced.'] },
{ n: 'Sled Push', c: 'functional', m: ['Legs', 'Conditioning'], s: ['Grip the poles low, arms extended, body at ~45°.', 'Drive with powerful steps for the distance.', 'Keep the back flat throughout.'] },
{ n: 'Medicine Ball Slam', c: 'functional', m: ['Core', 'Lats', 'Power'], s: ['Raise the ball overhead on the toes.', 'Slam it into the floor using the whole core.', 'Catch the bounce (or pick it up) and repeat.'] },
{ n: 'TRX Row', c: 'functional', m: ['Back', 'Core'], s: ['Lean back holding the straps, body straight.', 'Row the chest to the handles, squeezing the blades.', 'Lower with control; walk feet forward to make it harder.'] },

/* ---- Stretching ---- */
{ n: 'Chest Doorway Stretch', c: 'stretching', m: ['Pectorals', 'Anterior Deltoid'], s: ['Forearm on the door frame, elbow at shoulder height.', 'Step through gently until the chest stretches.', 'Hold 20–30 s per side, breathing slow.'] },
{ n: 'Lat Overhead Stretch', c: 'stretching', m: ['Lats'], s: ['Grab a bar or frame overhead with one hand.', 'Sink the hips back and to the side to lengthen the lat.', 'Hold 20–30 s per side.'] },
{ n: 'Standing Quad Stretch', c: 'stretching', m: ['Quadriceps', 'Hip Flexors'], s: ['Pull one heel to the glutes, knees together.', 'Push the hip slightly forward.', 'Hold 20–30 s per side; hold a wall if needed.'] },
{ n: 'Seated Hamstring Stretch', c: 'stretching', m: ['Hamstrings'], s: ['Sit with one leg extended, the other foot to the inner thigh.', 'Hinge forward from the hips toward the toes.', 'Hold 20–30 s per side without bouncing.'] },
{ n: 'Shoulder Cross-Body Stretch', c: 'stretching', m: ['Rear Deltoid'], s: ['Pull one arm across the chest with the other.', 'Keep the shoulder down, away from the ear.', 'Hold 20–30 s per side.'] },
{ n: 'Child’s Pose', c: 'stretching', m: ['Lower Back', 'Lats', 'Hips'], s: ['Kneel, sit back on the heels, arms reaching forward.', 'Let the chest sink toward the floor.', 'Hold 30–60 s, breathing deeply.'] }
];

/* Starter dummy programs — one per default category (deletable; seeded once).
   exerciseId refers to SEED_EXERCISES index as 'seed-N'. */
var SEED_PROGRAMS = [
  { name: 'Full Body Base', category: 'Maintenance', status: 'active', bg: 'pg3', days: [
    { dayNo: 1, name: 'Push', items: [
      { exerciseId: 'seed-0',  targetSets: 4, targetReps: '12/10/8/6', note: 'Warm up with 2 light sets first' },
      { exerciseId: 'seed-27', targetSets: 4, targetReps: '12/10/8/6', note: '' },
      { exerciseId: 'seed-41', targetSets: 3, targetReps: '12', note: '' } ] },
    { dayNo: 2, name: 'Pull', items: [
      { exerciseId: 'seed-8',  targetSets: 4, targetReps: 'max', note: '' },
      { exerciseId: 'seed-12', targetSets: 4, targetReps: '10', note: '' },
      { exerciseId: 'seed-33', targetSets: 3, targetReps: '12/10/8', note: '' } ] },
    { dayNo: 3, name: 'Legs & Core', items: [
      { exerciseId: 'seed-16', targetSets: 4, targetReps: '10/8/8/6', note: '' },
      { exerciseId: 'seed-23', targetSets: 4, targetReps: '15', note: '' },
      { exerciseId: 'seed-47', targetSets: 3, targetReps: '20', note: '' } ] } ] },
  { name: 'Mass Builder', category: 'Bulking', status: 'incoming', bg: 'pg1', days: [
    { dayNo: 1, name: 'Chest & Triceps', items: [
      { exerciseId: 'seed-0',  targetSets: 4, targetReps: '8/8/6/6', note: '' },
      { exerciseId: 'seed-1',  targetSets: 4, targetReps: '10/8/8/6', note: '' },
      { exerciseId: 'seed-40', targetSets: 3, targetReps: '8', note: '' } ] },
    { dayNo: 2, name: 'Back & Biceps', items: [
      { exerciseId: 'seed-10', targetSets: 4, targetReps: '8/8/6/6', note: 'Keep the back flat' },
      { exerciseId: 'seed-9',  targetSets: 4, targetReps: '10', note: '' },
      { exerciseId: 'seed-36', targetSets: 3, targetReps: '10/8/8', note: '' } ] },
    { dayNo: 3, name: 'Legs & Shoulders', items: [
      { exerciseId: 'seed-16', targetSets: 5, targetReps: '8/8/6/6/6', note: '' },
      { exerciseId: 'seed-17', targetSets: 4, targetReps: '10', note: '' },
      { exerciseId: 'seed-26', targetSets: 4, targetReps: '8/8/6/6', note: '' } ] } ] },
  { name: 'Shred Circuit', category: 'Cutting', status: 'reserve', bg: 'pg5', days: [
    { dayNo: 1, name: 'Burn A', items: [
      { exerciseId: 'seed-60', targetSets: 3, targetReps: '15', note: 'Short rests — 45 s max' },
      { exerciseId: 'seed-56', targetSets: 3, targetReps: '20', note: '' },
      { exerciseId: 'seed-52', targetSets: 3, targetReps: '60s', note: '' } ] },
    { dayNo: 2, name: 'Burn B', items: [
      { exerciseId: 'seed-61', targetSets: 3, targetReps: '12', note: '' },
      { exerciseId: 'seed-62', targetSets: 3, targetReps: '30s', note: '' },
      { exerciseId: 'seed-53', targetSets: 3, targetReps: '20', note: '' } ] },
    { dayNo: 3, name: 'Burn C', items: [
      { exerciseId: 'seed-57', targetSets: 3, targetReps: '12', note: '' },
      { exerciseId: 'seed-64', targetSets: 3, targetReps: '15', note: '' },
      { exerciseId: 'seed-48', targetSets: 3, targetReps: '20', note: '' } ] } ] },
  { name: 'Engine Builder', category: 'Endurance', status: 'old', bg: 'pg6', days: [
    { dayNo: 1, name: 'Carry & Core', items: [
      { exerciseId: 'seed-58', targetSets: 3, targetReps: '40m', note: '' },
      { exerciseId: 'seed-59', targetSets: 3, targetReps: '20m', note: '' },
      { exerciseId: 'seed-52', targetSets: 3, targetReps: '90s', note: '' } ] },
    { dayNo: 2, name: 'Power Endurance', items: [
      { exerciseId: 'seed-63', targetSets: 4, targetReps: '20m', note: '' },
      { exerciseId: 'seed-62', targetSets: 4, targetReps: '40s', note: '' },
      { exerciseId: 'seed-56', targetSets: 4, targetReps: '25', note: '' } ] },
    { dayNo: 3, name: 'Mixed', items: [
      { exerciseId: 'seed-65', targetSets: 3, targetReps: '15', note: '' },
      { exerciseId: 'seed-61', targetSets: 3, targetReps: '15', note: '' },
      { exerciseId: 'seed-60', targetSets: 3, targetReps: '12', note: '' } ] } ] },
  { name: 'My Experiment', category: 'Custom', status: 'reserve', bg: 'pg4', days: [
    { dayNo: 1, name: '', items: [
      { exerciseId: 'seed-49', targetSets: 4, targetReps: '15', note: 'From the old iOS app days' },
      { exerciseId: 'seed-5',  targetSets: 4, targetReps: '12/10/8/6', note: '' },
      { exerciseId: 'seed-35', targetSets: 3, targetReps: '12', note: '' } ] },
    { dayNo: 2, name: '', items: [
      { exerciseId: 'seed-13', targetSets: 4, targetReps: '6/5/5/3', note: '' },
      { exerciseId: 'seed-14', targetSets: 3, targetReps: '15', note: '' },
      { exerciseId: 'seed-30', targetSets: 3, targetReps: '12', note: '' } ] },
    { dayNo: 3, name: '', items: [
      { exerciseId: 'seed-19', targetSets: 3, targetReps: '20', note: '' },
      { exerciseId: 'seed-22', targetSets: 4, targetReps: '12', note: '' },
      { exerciseId: 'seed-68', targetSets: 2, targetReps: '30s', note: '' } ] } ] }
];
