<div align="center">

<img src=".assets/text-to-cad-demo.gif" alt="Demo of the text-to-cad harness generating and previewing CAD geometry" width="100%">

<br>

# ⚙ Open Source Text to CAD Harness ⚙

An open source harness for generating 3D models with your favorite coding agent

[Demo Explorer](https://text-to-cad.earthtojake.com)

[![GitHub stars](https://img.shields.io/github/stars/earthtojake/text-to-cad?style=for-the-badge&logo=github&label=Stars)](https://github.com/earthtojake/text-to-cad/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/earthtojake/text-to-cad?style=for-the-badge&logo=github&label=Forks)](https://github.com/earthtojake/text-to-cad/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Follow @soft_servo](https://img.shields.io/badge/Follow-%40soft__servo-000000?style=for-the-badge&logo=x)](https://x.com/soft_servo)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](.agents/skills/cad/requirements.txt)
[![build123d](https://img.shields.io/badge/build123d-CAD-00A676?style=for-the-badge)](https://github.com/gumyr/build123d)
[![OCP](https://img.shields.io/badge/OCP-OpenCascade-2F80ED?style=for-the-badge)](.agents/skills/cad/requirements.txt)
[![STEP](https://img.shields.io/badge/STEP-Export-4A5568?style=for-the-badge)](.agents/skills/cad/SKILL.md)
[![STL](https://img.shields.io/badge/STL-Export-4A5568?style=for-the-badge)](.agents/skills/cad/SKILL.md)
[![3MF](https://img.shields.io/badge/3MF-Export-4A5568?style=for-the-badge)](.agents/skills/cad/SKILL.md)
[![URDF](https://img.shields.io/badge/URDF-Robots-6B46C1?style=for-the-badge)](.agents/skills/urdf/SKILL.md)
[![Robot Motion](https://img.shields.io/badge/Robot%20Motion-IK%20%2B%20Planning-6B46C1?style=for-the-badge)](.agents/skills/robot-motion/SKILL.md)
[![Node.js](https://img.shields.io/badge/Node.js-CAD%20Explorer-339933?style=for-the-badge&logo=node.js&logoColor=white)](.agents/skills/cad/explorer/package.json)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111111)](.agents/skills/cad/explorer/package.json)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](.agents/skills/cad/explorer/package.json)

</div>

## 💬 Getting Started

To use text-to-cad, simply ask your agent (Codex, Claude Code, etc) to clone the repo:

```
https://github.com/earthtojake/text-to-cad
```

This will download the relevant AGENTS.md file and skills required to start generating 3D models and robot artifacts. The agent will start using the skills and load the local CAD explorer automatically.

## ✨ Features

- **Generate** - Create source-controlled CAD models with coding agents like Codex and Claude Code.
- **Export** - Produce STEP, STL, 3MF, DXF, GLB, topology data, and URDF robot descriptions.
- **Browse** - Inspect generated geometry in CAD Explorer.
- **Reference** - Copy stable `@cad[...]` references so agents can make precise follow-up edits.
- **Review** - Render quick review images for fast checks during an iteration loop.
- **Reproduce** - Edit source files first, then regenerate explicit targets.
- **Local** - Run the harness and CAD Explorer locally with no backend to host.

## 🧰 Bundled Skills

This harness vendors file-targeted skills for CAD, robot-description, robot-motion, and manufacturing-preflight work. Use the bundled copies here for local CAD projects, or use the dedicated repositories when installing the skills outside this harness.

- **CAD Skill** - STEP, STL, 3MF, DXF, GLB/topology, render images, and `@cad[...]` geometry references. [Bundled skill](.agents/skills/cad/SKILL.md) · [Standalone repo](https://github.com/earthtojake/cad-skill)
- **URDF Skill** - Generated URDF XML, robot links, joints, limits, validation, and mesh references. [Bundled skill](.agents/skills/urdf/SKILL.md) · [Standalone repo](https://github.com/earthtojake/urdf-skill)
- **Robot Motion Skill** - ROS 2/MoveIt setup, CAD Explorer motion artifacts, inverse kinematics, path planning, and motion-server testing for existing URDFs. [Bundled skill](.agents/skills/robot-motion/SKILL.md)

Skills live canonically under `.agents/skills` for Codex. Claude Code compatibility is provided by per-skill symlinks in `.claude/skills`.

## 📸 Screenshots

<table>
  <tr>
    <td width="33%">
      <a href="./.assets/text-to-cad-demo.gif">
        <img src="./.assets/text-to-cad-demo.gif" alt="CAD skill demo showing generated geometry in CAD Explorer" width="100%">
      </a>
      <a href="./.agents/skills/cad/SKILL.md"><strong>CAD</strong></a>
    </td>
    <td width="33%">
      <a href="./.assets/urdf-demo.gif">
        <img src="./.assets/urdf-demo.gif" alt="URDF skill demo showing robot description output in CAD Explorer" width="100%">
      </a>
      <a href="./.agents/skills/urdf/SKILL.md"><strong>URDF</strong></a>
    </td>
    <td width="33%">
      <a href="./.assets/robot-motion-demo.gif">
        <img src="./.assets/robot-motion-demo.gif" alt="Robot Motion skill demo showing inverse kinematics in CAD Explorer" width="100%">
      </a>
      <a href="./.agents/skills/robot-motion/SKILL.md"><strong>Robot Motion</strong></a>
    </td>
  </tr>
</table>

## 🔁 Workflow

1. **Describe** - Tell your agent about the part, assembly, fixture, robot, or mechanism you want.
2. **Edit** - Let your coding agent update repo-local CAD source files.
3. **Regenerate** - Create explicit STEP, STL, 3MF, DXF, GLB, or URDF targets.
4. **Inspect** - Open CAD Explorer to review the generated model.
5. **Reference** - Copy `@cad[...]` handles when you want geometry-aware edits.
6. **Commit** - Save the source and generated artifacts together once the model is ready.

## 🧪 Benchmarks

The repo stores `.assets/**` through Git LFS and excludes that tree from default LFS pulls so lightweight clones do not fetch GIF assets or benchmark detail pages. To hydrate only the benchmark assets locally, run:

```bash
git lfs pull --include=".assets/benchmarks/**"
```

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Target</th>
      <th>Prompt</th>
      <th>Output</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td><a href=".assets/benchmarks/01-rectangular-calibration-block.md">Rectangular calibration block with four holes</a></td>
      <td>Create a centered 100 x 60 x 20 mm block with four 8 mm vertical through-holes. Add only a 2 mm chamfer on the top outer perimeter.</td>
      <td><img src=".assets/benchmarks/benchmark_01_rectangular_calibration_block.gif" alt="Rectangular calibration block orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>2</td>
      <td><a href=".assets/benchmarks/02-circular-flange.md">Circular flange with bolt-hole pattern</a></td>
      <td>Create an 80 mm diameter, 10 mm thick circular flange with a 30 mm central through-bore. Add six 6 mm through-holes on a 60 mm bolt circle and fillet the outside circular edges.</td>
      <td><img src=".assets/benchmarks/benchmark_02_circular_flange.gif" alt="Circular flange orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>3</td>
      <td><a href=".assets/benchmarks/03-l-bracket.md">L-bracket with gussets and two hole directions</a></td>
      <td>Create an L-bracket from a base plate and rear vertical plate. Add vertical base holes, horizontal back-plate holes, two triangular gussets, and a filleted base/back transition.</td>
      <td><img src=".assets/benchmarks/benchmark_03_l_bracket.gif" alt="L-bracket orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>4</td>
      <td><a href=".assets/benchmarks/04-stepped-shaft-keyway.md">Stepped shaft with keyway</a></td>
      <td>Create a 120 mm shaft along X with 20/30/20 mm diameter stepped sections. Add end chamfers and a shallow rectangular keyway on top of the middle section.</td>
      <td><img src=".assets/benchmarks/benchmark_04_stepped_shaft_keyway.gif" alt="Stepped shaft orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>5</td>
      <td><a href=".assets/benchmarks/05-open-top-electronics-enclosure.md">Open-top electronics enclosure with bosses</a></td>
      <td>Create a hollow open-top enclosure with 3 mm walls and floor. Add four internal standoffs with centered blind holes and 2 mm outside vertical corner fillets.</td>
      <td><img src=".assets/benchmarks/benchmark_05_open_top_electronics_enclosure.gif" alt="Open-top electronics enclosure orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>6</td>
      <td><a href=".assets/benchmarks/06-clevis-bracket-lightening-cutouts.md">Aerospace-style clevis bracket with lightening cutouts</a></td>
      <td>Create a symmetric clevis bracket with a base plate, two rounded lugs, base mounting holes, and a horizontal lug bore. Add triangular lightening cutouts, reinforcing ribs, and rounded transitions.</td>
      <td><img src=".assets/benchmarks/benchmark_06_clevis_bracket_lightening_cutouts.gif" alt="Clevis bracket orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>7</td>
      <td><a href=".assets/benchmarks/07-radial-engine-cylinder.md">Radial-engine-style cylinder with cooling fins</a></td>
      <td>Create a vertical engine-cylinder form with a central barrel, 12 cooling fins, a base flange, and a top cap. Add a 35 degree angled spark-plug boss with a coaxial through-hole.</td>
      <td><img src=".assets/benchmarks/benchmark_07_radial_engine_cylinder.gif" alt="Radial-engine-style cylinder orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>8</td>
      <td><a href=".assets/benchmarks/08-centrifugal-impeller.md">Centrifugal impeller with backward-curved blades</a></td>
      <td>Create a centrifugal impeller with a backplate, hub, and through-bore. Add 12 fused backward-curved blades sweeping about 45 degrees from root to tip.</td>
      <td><img src=".assets/benchmarks/benchmark_08_centrifugal_impeller.gif" alt="Centrifugal impeller orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>9</td>
      <td><a href=".assets/benchmarks/09-spiral-staircase.md">Spiral staircase with helical handrail</a></td>
      <td>Create a miniature spiral staircase with a central column, base disk, and 20 rising wedge treads. Add a one-revolution helical handrail and vertical balusters at the tread outer ends.</td>
      <td><img src=".assets/benchmarks/benchmark_09_spiral_staircase.gif" alt="Spiral staircase orbit gif" width="220"></td>
    </tr>
    <tr>
      <td>10</td>
      <td><a href=".assets/benchmarks/10-planetary-gear-stage.md">Simplified planetary gear stage</a></td>
      <td>Create a flat planetary gear assembly with separate sun, planet, ring, carrier, and pin bodies. Use simplified trapezoidal teeth and place three planets around the sun on a 42 mm radius circle.</td>
      <td><img src=".assets/benchmarks/benchmark_10_planetary_gear_stage.gif" alt="Planetary gear stage orbit gif" width="220"></td>
    </tr>
  </tbody>
</table>

## 🚀 Quick Start

Clone the repo:

```bash
git clone https://github.com/earthtojake/text-to-cad.git
cd text-to-cad
```

Install Python CAD dependencies:

```bash
python3.11 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/pip install -r .agents/skills/cad/requirements.txt
```

Install other bundled skill requirements only when you need those workflows:

```bash
./.venv/bin/pip install -r .agents/skills/urdf/requirements.txt
```

Install CAD Explorer dependencies:

```bash
npm --prefix .agents/skills/cad/explorer install
```

Run the local CAD Explorer from the project directory you want to scan:

```bash
npm --prefix .agents/skills/cad/explorer run dev
```

Then open [http://localhost:4178](http://localhost:4178).

For root-aware agent workflows across multiple projects, ask CAD Explorer to
reuse a matching server or start one on a free port:

```bash
npm --prefix .agents/skills/cad/explorer run dev:ensure -- --file STEP/sample_part.step
```

Then open the URL printed by the command.
