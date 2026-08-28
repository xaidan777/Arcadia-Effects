# Arcadia Effector

**Standalone 2D particle effect editor built for humans and LLMs.**

Arcaidia Effector is a real-time 2D VFX editor inspired by tools such as Trapcode Particular.

It is designed around a simple idea: **an LLM should be able to understand the entire editor, generate an effect, and let the editor turn that effect into a production-ready sprite atlas.**

Claude Code, Codex, or another coding agent can directly create and modify effects, while artists can edit the exact same effects manually through the visual interface.

[![Arcaidia Effector Overview](https://img.youtube.com/vi/nHztjZHce7w/maxresdefault.jpg)](https://www.youtube.com/watch?v=nHztjZHce7w)

[▶ Watch Arcaidia Effector overview on YouTube](https://www.youtube.com/watch?v=nHztjZHce7w)

## Highlights

- **LLM-friendly architecture** - the entire editor codebase is intentionally readable and understandable by coding agents.
- **AI-generated effects** - Claude Code or Codex can "write" an effect and Effector can render it into a sprite atlas.
- **Full manual editor** - effects can also be created completely by hand.
- **Powerful emitter system** - particles, paths, sub-emitters, trails, branching, gradients, physics and more.
- **Real-time simulation** - up to **20,000 particles in real time** on an i7 / RTX 3070 system without prerendering.
- **Sprite atlas export** - render effects directly into game-ready PNG atlases.
- **Deterministic simulation** - preview, timeline scrubbing and export produce the same result.
- **Standalone** - vanilla JavaScript + Canvas2D.
- **Zero dependencies.**
- **Zero `npm install`.**
- The whole project folder is portable and self-contained.

---

## LLM-first workflow

Arcaidia Effector is designed so that the editor itself can become part of an AI-assisted VFX pipeline.

A coding agent can:

1. Read the editor architecture.
2. Understand the effect data format.
3. Create or modify an effect.
4. Validate the effect.
5. Open it in Effector.
6. Let the artist adjust it manually if necessary.
7. Export the final result as a sprite atlas or PNG sequence.

The editor does not hide the effect behind a proprietary binary format.

An effect is simply a JSON document containing the effect structure and its textures.

For Claude Code and other LLM agents:

- [`CLAUDE.md`](CLAUDE.md) - agent workflow and project rules
- [`skills/*/SKILL.md`](skills/) - subsystem-specific instructions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - architecture
- [`docs/FORMAT.md`](docs/FORMAT.md) - effect data format

---

## Standalone by design

The editor uses:

- Vanilla JavaScript
- Canvas2D
- Classic browser scripts
- A tiny optional Node.js server

There is no build step and no dependency installation.

You can copy the entire folder to another machine and run it there.

---

## Running the editor

### Recommended

Double-click:

```text
run.bat
```

This starts:

```text
node server.mjs
```

on port:

```text
5179
```

and opens the editor in your browser.

When running through the server, effects are saved as files in:

```text
library/*.json
```

These files can be committed to Git.

### Browser-only mode

You can also open:

```text
index.html
```

directly in a browser.

The full editor still works, but the effect library is stored in browser `localStorage` instead of the `library/` directory.

The currently opened effect is automatically saved to the browser session and restored after restart.

---

## Interface language

English is the default interface language.

Russian is available through:

```text
Settings -> Language
```

Changing the language reloads the page without losing the current session.

Preset and layer names remain in English in both interface languages.

The `?` button next to Settings opens the About / Help window with version and author information.

---

# Editor layout

| Area | Purpose |
|---|---|
| Top left | Composition, camera compression and sprite atlas export settings |
| Bottom left | Effect library with user and built-in effects |
| Top right | Texture browser, texture import and sprite-sheet tools |
| Bottom right | Inspector for the selected layer |
| Center | Live Preview and Atlas views |
| Bottom | Timeline, layer management, keyframes, lifetime curves and graph editor |

The timeline contains the complete layer stack.

Available layer types include:

```text
+ Emitter
+ Sprite
+ Atlas
+ Post FX
```

and layer presets.

Layers can be:

- added
- renamed
- reordered
- hidden
- soloed
- duplicated
- deleted
- copied between effects

---

# Core concepts

## Camera compression

Compression simulates the viewing angle of the effect plane.

```text
0  = side view
37 = game isometric view
```

At the isometric setting:

```text
scaleY = 0.8
```

Particle positions are always compressed.

Sprite compression can be controlled per layer.

This makes it possible to combine:

- flat ground rings
- impact decals
- billboard particles
- vertical explosions
- isometric VFX

inside the same effect.

---

# Layers

## Emitter

The Emitter layer is the main particle source.

Emitter shapes include:

- Point
- Circle
- Ring
- Box
- Line
- Animated path

Particle parameters include:

- direction
- velocity
- continuous emission
- bursts
- lifetime
- size over lifetime
- opacity over lifetime
- color gradient over lifetime
- gravity
- drag
- turbulence
- glow
- velocity stretching

The layer bar on the timeline defines the **emission window**.

Particles already emitted are allowed to continue living after the layer bar ends.

---

## Sprite

A Sprite layer represents a single graphical element.

It supports animation of:

- position
- scale
- rotation
- color
- opacity
- glow

Sprite layers are useful for:

- flashes
- shockwaves
- highlights
- ground rings
- impact graphics

---

## Atlas

The Atlas layer is designed specifically for existing sprite sheets.

It supports:

- position
- frame size
- scale
- rotation
- blending
- opacity
- layer glow
- radial fade

Unlike a regular Sprite layer, an Atlas layer does not receive default scale or opacity animation.

The source is always a sprite-sheet texture.

---

## Post FX

Post FX works similarly to an adjustment layer.

It does not render anything by itself.

Instead, it processes the already-rendered pixels of every layer located below it in the timeline.

The current Post FX implementation provides **motion blur**.

---

# Layer order and blending

The uppermost timeline row is rendered on top.

Layers can be reordered by dragging them.

Available blend modes:

```text
normal
add
screen
multiply
```

Use `Shift + Click` to select multiple layers.

Dragging one selected layer bar moves the entire selection.

Layer start time can also be negative.

This creates a **pre-roll**, allowing particles to begin simulation before frame zero and already exist when the exported animation starts.

---

# Glow

Effector provides particle-level and layer-level glow.

Particle glow parameters include:

- Glow Strength
- Glow Size
- Softness

Glow strength can exceed `1`, creating additional additive passes.

Layer glow applies post-processing to the entire rendered layer.

This is particularly useful for:

- lightning
- trails
- composite layers
- energy effects
- bright impact effects

Layer glow parameters can also be animated with keyframes.

---

# Preview gizmos

Selected layers display interactive controls directly in the preview.

The center cross gizmo can move:

- emitters
- sprites
- Post FX centers

If the parameter is animated, moving the gizmo can automatically create a keyframe.

---

## Radial fade gizmo

When Radial Fade is enabled, an additional circular controller appears.

You can interactively control:

- fade center
- fade radius
- softness

The mask fades the entire layer based on the distance from its center.

For lightning layers, the fade affects all branches and the corresponding layer glow.

---

# Animated motion paths

Emitter paths work similarly to animation paths or masks in compositing software.

A path consists of nodes.

Every node has its own animated:

```text
X
Y
```

tracks.

Because nodes are positioned relative to the emitter, moving the main emitter gizmo moves the complete path.

Paths can be:

- linear
- Catmull-Rom smoothed
- open
- closed

### Editing paths

- Drag a node to move it
- Double-click a line to insert a node
- Double-click a node to delete it
- `Alt + Click` a line to create and immediately drag a node

Right-clicking the preview opens path-related actions.

You can:

- animate a node
- add a keyframe
- remove node animation
- delete a node
- insert a node
- change path mode
- toggle smoothing
- close / open the path
- reverse direction
- disable the path

---

# Path modes

Paths can operate in three modes.

## Emit Along Path

Particles are born directly on the path.

The normal emitter shape is ignored.

Spawn distribution can be:

- Random
- Uniform along path
- Beginning of path

Additional parameters include:

- spawn spread
- emission direction
- tangent direction
- perpendicular direction

A simple two-node animated path can already create effects such as a sword trail.

For example:

```text
Blade (path)
```

uses a moving path where particles are emitted along the entire blade.

---

## Particle Guidance

A path can also affect particles after they have been emitted.

Available controls include:

### Attraction

Pulls particles toward the nearest point on the path.

### Path adherence

Controls how strongly particles stick to the path.

At:

```text
1.0
```

the particle follows the path completely.

If the path itself moves, attached particles move with it.

### Flow speed

Moves particles along the path tangent.

Negative values reverse the flow direction.

A smoothed S-curve combined with strong adherence and flow can create particles traveling along complex trajectories.

---

## Fast path search

Fast Search is enabled by default.

Instead of globally searching the entire path for the nearest point every simulation step, the engine searches a region around the previously detected point.

On non-self-intersecting paths, the result is bit-identical while resimulation can be roughly three times cheaper.

Disable Fast Search if the path crosses itself and particles are expected to jump between branches.

This option is stored inside the effect file because it can influence the final simulation result.

---

## Emit + Guide

Both systems can operate simultaneously.

Particles can be spawned on a path and continue to be controlled by it afterwards.

All major path parameters can be keyframed.

This includes:

- node X/Y
- spread
- attraction
- adherence
- flow speed

Path animation tracks appear directly on the timeline.

---

# Lightning system

Emitters support a dedicated Trail rendering mode.

Particles can render their trajectory as glowing lines.

Additional features include:

- white trail core
- glow
- animated zigzag
- branching

The branching system allows a moving particle to generate child branches from its current position.

You can control:

- branching probability
- angular spread
- branch length
- branch thickness
- number of generations

Branches become shorter and thinner than their parents.

Included examples:

```text
Lightning
Lightning Strike
```

`Lightning Strike` combines:

- sky flash
- main lightning bolt
- branching
- ground impact
- sparks

---

# Sub-emitters

A particle can itself become an emitter.

This provides a multi-level particle system similar in spirit to auxiliary particle systems found in high-end VFX tools.

Child particles have their own complete settings:

- sprite
- lifetime
- size curve
- opacity curve
- color gradient
- physics
- glow
- trail mode

Unlike Lightning Branching, a sub-emitter does not simply inherit the visual appearance of its parent.

---

## Sub-emitter modes

### On parent death

Emits a burst when the parent particle dies.

Useful for:

- secondary explosions
- fireworks
- impact fragments

### During parent lifetime

Continuously emits particles while the parent is alive.

Useful for:

- smoke trails
- sparks
- fire trails
- debris trails

Both modes can be enabled simultaneously.

---

## Sub-emitter direction

Child particles can move:

- in all directions
- along parent velocity
- opposite parent velocity
- away from emitter center

They can also inherit part of the parent's velocity.

---

## Multiple generations

Sub-emitters support multiple generations.

Children can create their own children using the same configuration.

Each generation can become:

- smaller
- shorter-lived

using the Generation Scale parameter.

---

## Particle budget

Sub-emitters can create extremely large particle counts.

For example:

```text
20 particles/sec × 200 parents = 4,000 child particles/sec
```

A dedicated sub-particle budget provides a hard cap on the number of living child particles.

For inexpensive effects, start with emission on parent death.

Included preset:

```text
Firework (sub-emitter)
```

---

# Multiple effects

Switching between effects in the library does not discard unsaved work.

Every effect receives its own working copy in the current session.

Each copy also has its own undo history.

Modified effects are marked with a dot.

Only the **Save** command writes changes to the actual effect file.

The complete working session survives browser reloads through `localStorage`.

Right-click an effect in the library and choose Reset Changes to return to the saved or built-in version.

---

# Copy layers between effects

Layers can be copied between separate effects.

Select one or multiple layers:

```text
Shift + Click
```

then:

```text
Ctrl + C
```

switch to another effect and use:

```text
Ctrl + V
```

The complete layer data is copied together with metadata for all required textures.

---

# Particle sprites

Built-in procedural particle sprites include:

- Soft Circle
- Circle
- Ring
- Square
- Polygon
- Star
- Dash
- Spark
- Smoke Puff
- Multi Puff
- Fragment

Several sprite types include multiple shape variants and can use either a fixed or random variant.

Custom textures can also be imported.

---

# Animated textures / footage

Imported textures can be marked as sprite-sheet footage.

Configure:

```text
columns
rows
fps
```

Both particles and Sprite layers can play animated textures frame by frame.

Textures can be dragged directly from the Texture panel into:

- Preview
- Timeline

to create a new layer.

---

# Sprite-sheet Atlas layer

Press:

```text
+ Atlas
```

on the timeline.

The Sprite Atlas dialog opens.

It contains:

- drag-and-drop area
- file picker
- existing project sprite sheets
- sheet preview
- grid overlay
- suggested grid presets
- columns
- rows
- FPS

Pressing **Accept** imports the texture if necessary and creates the layer.

Pressing **Cancel** changes nothing.

---

## Atlas playback

The Atlas layer duration is initially based on:

```text
frames / fps
```

If:

```text
Footage FPS = 0
```

frames are stretched to exactly match the timeline bar.

Changing the bar length therefore changes playback speed.

Set an FPS above zero to use fixed-speed looping playback.

---

# Texture sprite-sheet import

The **Atlas** button in the Texture panel opens the same sprite-sheet dialog without creating a layer.

Effector automatically suggests a grid based on the texture aspect ratio.

The preview shows the resulting grid.

Additional presets such as:

```text
2x1
4x2
8x4
```

can be selected manually.

Accepting the dialog imports the texture as configured footage.

---

# Post FX motion blur

Post FX currently supports two Motion Blur modes.

## Directional

Uses one blur direction for the whole frame.

Useful for:

- camera movement
- fast impacts
- whip pans
- directional motion

## Radial

Creates zoom and/or rotational blur around a center point.

Useful for:

- explosions
- impacts
- shockwaves
- camera punches

The blur center can be moved directly in the Preview using a gizmo.

---

## Motion blur parameters

### Length

Blur length in pixels.

It can be animated with keyframes.

```text
Length = 0
```

disables the effect.

### Strength

Uses layer opacity as the blend between the clean and processed image.

```text
0 = clean image
1 = fully blurred image
```

This can also be keyframed.

### Samples

Available range:

```text
2 .. 64
```

Sampling is implemented through doubling passes.

For example, 16 samples require four full-frame passes instead of sixteen complete renders.

### Half Resolution

Motion blur can be processed in a buffer containing one quarter of the full pixel count.

This is faster and produces a slightly softer result.

---

## Post FX performance

Post FX should usually be placed as low in the layer stack as possible.

The GPU blur itself is inexpensive.

The larger cost comes from rendering every affected layer into an intermediate canvas before processing.

In one 2,000-particle test:

```text
Post FX above everything:       ~6.2 ms
Post FX above last 500 particles: ~0.9 ms
```

Motion Blur operates on the already-rendered frame.

If individual particles need to stretch according to their own velocity, use **Velocity Stretching** in the emitter instead.

---

# Animation and keyframes

Parameters can be animated directly in the Inspector.

Click the stopwatch next to a parameter to create an animation track.

When animation is enabled, changing the parameter at the current timeline position automatically creates a keyframe.

The diamond button can also manually add or remove a keyframe.

---

## Layer-relative time

Keyframe time is stored relative to the beginning of the layer.

This means moving a layer bar moves its complete animation together with it.

---

## Interpolation

Right-click a keyframe to select:

- Linear
- Easy Ease
- Ease In
- Ease Out
- Hold

---

# Graph editor

The timeline includes a graph editor for animated parameters.

You can:

- move keys in time
- move keys in value
- edit Bezier handles
- create custom easing
- add keys
- remove keys

Particle lifetime curves can also be edited here.

---

# Lifetime curves

Particles support dedicated curves for:

- size over lifetime
- opacity over lifetime

These curves can be edited either:

- in compact Inspector editors
- in the large Timeline graph editor

The horizontal axis represents normalized particle lifetime:

```text
0.0 -> birth
1.0 -> death
```

---

# Color over lifetime

Particle color uses a gradient editor directly in the timeline.

You can:

- click to create a color stop
- drag a stop to move it
- right-click to delete it
- double-click to edit its color

---

# Sprite atlas export

Effector can render the current effect directly into a sprite atlas.

Export settings include:

- columns
- rows
- frame count
- cell size
- time range
- 2x supersampling

Frames are sampled from the centers of their time intervals, preventing the first cell from being accidentally empty.

---

## Export modes

### Color + Transparent Background

Standard RGBA atlas.

### Color on Black

Renders the effect against a black background.

### Mask

Renders the effect as white on black.

An optional Threshold setting can convert soft edges into a binary mask.

---

## Atlas metadata

The **Meta JSON** action copies:

```json
{
  "frameWidth": 0,
  "frameHeight": 0,
  "frames": 0,
  "fps": 0
}
```

style metadata for the current export configuration.

Use **Download PNG** to render and download the final atlas.

---

# PNG sequence export

The Sequence Export dialog supports:

- frame size
- FPS
- time range
- export mode
- 2x supersampling
- output name

The result is a single:

```text
.zip
```

containing numbered PNG files:

```text
Effect_0000.png
Effect_0001.png
Effect_0002.png
...
```

and:

```text
meta.json
```

Atlas and sequence exports use the same sampling logic.

With identical settings, frame `N` of the PNG sequence is pixel-identical to cell `N` of the sprite atlas.

Maximum sequence length:

```text
600 frames
```

Sequence export settings belong to the current editor session and are not stored inside the effect file.

---

# Phaser example

A generated atlas can be loaded as a standard Phaser sprite sheet:

```js
this.load.spritesheet('fx', 'fx.png', {
  frameWidth: W,
  frameHeight: H
});
```

---

# Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Play / Pause |
| `Left / Right` | Previous / next frame |
| `Shift + Left / Right` | Move by 10 frames |
| `Home / End` | Beginning / end |
| `Delete` | Delete selected keys, otherwise selected layers |
| `U` | Expand / collapse selected layer parameters |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + S` | Save effect |
| `Ctrl + C` | Copy layers |
| `Ctrl + V` | Paste layers |
| `Ctrl + D` | Duplicate layer |
| `F` | Fit preview |
| `Shift + Click` | Multi-select layers |
| `Ctrl + Mouse Wheel` | Timeline zoom |
| `Middle Mouse Drag` | Timeline / graph pan |
| `Mouse Wheel in Preview` | Preview zoom |
| `Left / Middle Mouse Drag in Preview` | Preview pan |
| `Double Click Preview` | Fit preview |

---

# Deterministic simulation

Particle simulation uses:

```text
fixed timestep: 1 / 120 sec
```

and a seeded random number generator.

As a result:

- timeline scrubbing
- resimulation
- Preview
- sprite atlas export
- sequence export

produce the same result for the same effect state.

Changing the emitter Seed creates a different particle distribution while keeping all other settings identical.

---

# Project structure

```text
index.html
    Entry point.
    Classic scripts, no build step.

css/editor.css
    Editor UI theme.

js/core/
    utils
    track
    curve
    path
    sprites
    model
    sim
    engine
    atlas
    fxpresets

js/ui/
    dom
    widgets
    ops
    textures
    inspector
    globalspanel
    catalog
    preview
    timeline
    app

server.mjs
    Static server + library API.
    No dependencies.

library/
    Saved effect JSON files.

library/textures/
    Collected texture files + index.json.

tools/
    validate.mjs
    collect.mjs
```

---

# Effect format

An effect is stored as a single JSON document.

It contains:

- effect document
- animation data
- particle settings
- layer structure
- texture data

Textures can be embedded as data URLs.

This means an effect can be moved between installations through a single file without relying on absolute filesystem paths.

See:

[`docs/FORMAT.md`](docs/FORMAT.md)

---

# Moving the project to another machine

The editor folder is self-contained.

Each:

```text
library/*.json
```

effect stores its required textures inside the file.

There are no required absolute paths or external project dependencies.

Before moving the editor to another machine:

### 1. Save drafts

Unsaved effects are shown in the **Unsaved** group and marked with orange dots.

The working session itself lives in browser `localStorage` and will not move together with the folder.

### 2. Collect textures

Run:

```bash
node tools/collect.mjs
```

This refreshes:

```text
library/textures/
```

and checks that every effect contains the textures it references.

### 3. Validate effects

Run:

```bash
node tools/validate.mjs
```

This verifies that the effect files can be loaded and simulated.

---

# Requirements

For the recommended server mode:

```text
Node.js
```

That is all.

Without Node.js, the editor can still be opened directly through:

```text
index.html
```

In that mode the library is stored in browser `localStorage` instead of `library/`.

---

# Why Arcaidia Effector?

Most VFX editors are designed around a human manually manipulating a closed graphical system.

Arcaidia Effector is designed around a different workflow.

**The editor is simultaneously a visual tool and an API surface for an LLM.**

The artist can describe an effect.

The LLM can build it.

The editor can simulate it.

The artist can adjust it.

And the final result can be exported directly into a game-ready sprite atlas.

No proprietary runtime.

No hidden scene format.

No dependency-heavy toolchain.

Just code, JSON, particles and pixels.
