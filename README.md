# ArcGIS Web Map Visualization

This project contains an ArcGIS Maps SDK for JavaScript visualization demo with two views:

- Election gap visualization (Obama vs McCain 2008 precinct-level data)
- Custom 3D scene with a tintable tile layer (OpenTopoMap)

## Visualization Background

The goal of this visualization is to show how visual variables and feature effects can make map patterns easier to understand:

- A gap slider animates and filters precincts by vote difference percentage
- Hover interactions show tooltip-based chart summaries for each precinct
- Click interaction animates directly to a selected precinct gap
- A second tab demonstrates a custom tile layer rendered in a scene with dynamic tint control

## Tech Stack

- ArcGIS Maps SDK for JavaScript 5.0 (CDN)
- ArcGIS Web Components (Map, Scene, Legend, Layer List, Expand, etc.)
- Calcite Components (Slider, Button, Color Picker, Shell, Block)
- HTML5
- CSS3
- Vanilla JavaScript (ES Modules)

## Project Structure

- visualization-vv-opacity-animate.html: Main page markup
- styles.css: All visual styling
- app.js: Interactive map/scene logic
- assets/webmap-screenshot.svg: Screenshot placeholder image

## Screenshot

![Web map screenshot](./assets/webmap-screenshot.svg)

## Run Locally

Because the page uses ES modules, run it from a local web server instead of opening the file directly.

### Option 1: VS Code Live Server

1. Open the folder in VS Code.
2. Right-click `visualization-vv-opacity-animate.html`.
3. Select **Open with Live Server**.

### Option 2: Python HTTP server

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/visualization-vv-opacity-animate.html`.

## Credits

- Election layer and basemap resources via ArcGIS portal items
- OpenTopoMap and OpenStreetMap contributors for tile resources
