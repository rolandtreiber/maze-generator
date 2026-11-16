# Maze Workshop

[Open Maze Workshop](https://rolandtreiber.github.io/maze-generator/)

Maze Workshop designs laser-cut tilt mazes for a ball bearing. The finished puzzle sandwiches a wooden maze layer between a wooden base and a top made from a wooden rim and a clear acrylic window. Tilt the assembled puzzle to roll the ball from **S** to **F**.

The app uses React, TypeScript, and Vite. Drawing, image tracing, maze generation, previews, and downloads all run in the browser. Imported images stay on your device.

## Design a maze

1. **Choose the board outline.** Start with a hexagon, pentagon, square, or triangle. For a custom outline, import an image with a black silhouette on a white or transparent background, or use **Draw shape** to build it with the brush, rectangle, ellipse, and erase tools. White or transparent areas inside the silhouette become holes. Separate black islands can each become a playable maze if they have room for a continuous window and a route.
2. **Choose the maze cells.** The cell pattern and board outline are independent. For example, choose a square outline and hexagonal cells to fit a honeycomb maze inside a square board. Square, triangle, and hexagon use regular polygons. The pentagon pattern uses alternating house-shaped tiles that fit edge to edge.
3. **Set complexity and dimensions.** Enter the ball diameter, finished board width, and cutting sheet width and height in millimetres. The board height follows the outline's proportions. Higher complexity packs cells more closely when space allows. Select **New layout** to generate another arrangement with the same settings.
4. **Inspect the puzzle.** The top view shows the finished footprint, and the readouts show passage clearance and minimum maze stock thickness. Select **Show solution** to trace the route. In **3D view**, drag to rotate, Shift-drag or select **Pan mode** to pan, and scroll to zoom. **Explode layers** shows how the base, maze, rim, and window fit together.
5. **Export the files.** Use **Download all** under **Cut files** or **Download ZIP** in the header. You can also save any SVG individually. The app rotates the design by 90° if needed to fit the sheet and disables export if the design has no playable route or cannot fit.

## What the generator does

The generator insets the board outline to make the acrylic window, then places the selected cell pattern inside it. For each playable piece, it takes the largest connected group of cells and opens selected shared walls until all cells in that group are reachable. The openings form a tree, so there is one route between any two cells. The endpoints of the longest route become the start and finish.

Openings span the full shared edge. Three square cells in a row produce a single straight corridor with parallel walls. Square corridors are the ball diameter plus 0.25 mm wide, and passages in the other patterns provide at least that width. The top view, 3D view, and cut files use the same geometry.

## SVG files and assembly

The ZIP contains four 1:1 SVGs. Each uses the selected sheet dimensions and shares the same placement and orientation.

| File | Purpose |
| --- | --- |
| `maze-layer.svg` | Cut the middle wood layer, including the outside profile and the closed contours that define the passages. |
| `base-and-rim.svg` | Cut the base and top rim from the same wood stock. The centre piece is the base and carries the green **S** and **F** marks. The surrounding wood forms the top rim. |
| `acrylic-window.svg` | Cut the clear top insert. Its outline matches the wooden base. |
| `solutions.svg` | Use as a reference. It contains one continuous centreline for each playable maze. |

Black 1 px strokes identify the cut paths. The green circles and white letter shapes in the base file are marking artwork. Apply any material and kerf compensation in your laser software, since the SVGs use nominal dimensions.

Mount the base underneath the maze layer and place the bearing inside before fastening the rim and acrylic window over the maze. The design uses a nominal 5 mm rim and leaves a 2 mm ledge between the passages and the insert edge. The 3D preview depicts 3 mm stock for the base, top rim, and acrylic. Use the minimum maze stock thickness displayed in the app to choose the middle layer.

## Run locally

Use Node.js 20.19 or later in the 20.x line, or Node.js 22.12 or later.

```sh
git clone https://github.com/rolandtreiber/maze-generator.git
cd maze-generator
npm ci
npm run dev
```

Open the URL printed by Vite. To type-check and build the static app, run `npm run build`. The output is written to `dist/` and can be checked locally with `npm run preview`.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) builds the app with Node.js 24 and publishes `dist/` after pushes to `main`. It can also be run manually from the repository's **Actions** tab. The repository uses **GitHub Actions** as its Pages publishing source.
