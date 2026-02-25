# Route Visualizer (Leaflet + OSM + Overpass) — A*, Dijkstra & More

A small web app that visualizes **real road network pathfinding** on top of an interactive map.
It downloads road data from **OpenStreetMap** via the **Overpass API**, builds a graph locally in the browser, and then animates how different algorithms explore the graph from point A to point B.

> This project is aimed at learning and demos: you can literally *watch* the search frontier expanding and see how algorithm choices affect performance and route quality.

## Features
- Interactive **Leaflet** map with OpenStreetMap tiles
- Loads a **real road network** from the current map viewport using Overpass API
- Click-to-place **Start (A)** and **Goal (B)** snapped to the nearest road node
- Animated visualization:
  - open set / closed set nodes
  - inspected edges
  - relaxed edges
  - final path (highlighted)
- Multiple algorithms with a clean, extensible architecture:
  - **Dijkstra (optimal)**
  - **A* (optimal)** using straight-line heuristic
  - **Bidirectional Dijkstra (optimal, often faster)**
  - **Weighted A* (faster, not guaranteed optimal)** (ε = 1.5)
  - **Greedy Best-First (very fast, not optimal)**
  - **BFS (fast on hops, ignores weights; not optimal for real distances)**

## How to run (Windows/macOS/Linux)
You should run it from a local server (because it fetches Overpass data).

### Option A — Python
py -m http.server 8000
http://localhost:8000

### Option B — VS Code “Live Server”
  1. Install the Live Server extension.
  2. Right-click index.html
  3. Select Open with Live Server

### Usage
1. Zoom into a small area (neighborhood/district). Large viewports can be slow.
2. Click Load roads (view) to fetch the road network from Overpass.
3. Click on the map to set A (Start), then click again to set B (Goal).
3. Choose an algorithm and press Start.
5. Use Pause/Resume and adjust animation speed as needed.

Notes / Limitations
  - The Overpass API is a shared public service — avoid huge bounding boxes and repeated rapid requests.
  - The visualization uses a simplified road model:
    - graph nodes = OSM way nodes
    - edges = straight segments between consecutive nodes
  - For clarity in the walking profile, many ways are treated as bidirectional.

### Credits
 - Map tiles & data: © OpenStreetMap contributors
 - Map rendering: Leaflet
 - Road network download: Overpass API
