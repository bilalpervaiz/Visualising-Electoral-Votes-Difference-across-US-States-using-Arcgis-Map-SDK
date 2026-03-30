const [Map, FeatureLayer, promiseUtils, esriRequest, Color, BaseTileLayer, reactiveUtils] =
  await $arcgis.import([
    "@arcgis/core/Map.js",
    "@arcgis/core/layers/FeatureLayer.js",
    "@arcgis/core/core/promiseUtils.js",
    "@arcgis/core/request.js",
    "@arcgis/core/Color.js",
    "@arcgis/core/layers/BaseTileLayer.js",
    "@arcgis/core/core/reactiveUtils.js",
  ]);

// Toggle buttons swap between the election map and the custom scene demo.
const showElectionBtn = document.getElementById("showElection");
const showSceneBtn = document.getElementById("showScene");
const electionPane = document.getElementById("electionPane");
const scenePane = document.getElementById("scenePane");

function setActivePane(paneName) {
  const showElection = paneName === "election";
  electionPane.classList.toggle("active", showElection);
  scenePane.classList.toggle("active", !showElection);
  showElectionBtn.classList.toggle("active", showElection);
  showSceneBtn.classList.toggle("active", !showElection);
}

showElectionBtn.addEventListener("click", () => setActivePane("election"));
showSceneBtn.addEventListener("click", () => setActivePane("scene"));

//--------------------------------------------------------------------------
//  Election map sample setup
//--------------------------------------------------------------------------

const electionLayer = new FeatureLayer({
  portalItem: {
    id: "359bc19d9bbb4f2ba1b2baec7e13e757",
  },
  outFields: ["PERCENT_GAP"],
  definitionExpression: "(P2008_D > 0) AND (P2008_R > 0)",
  title: "Voting precincts",
  opacity: 1,
  renderer: {
    type: "unique-value",
    field: "Majority",
    uniqueValueInfos: [
      {
        value: "Obama",
        symbol: {
          type: "simple-marker",
          size: 9,
          color: "rgb(0, 92, 230)",
          outline: null,
        },
      },
      {
        value: "McCain",
        symbol: {
          type: "simple-marker",
          size: 9,
          color: "rgb(255, 20, 20)",
          outline: null,
        },
      },
      {
        value: "Tied",
        symbol: {
          type: "simple-marker",
          size: 9,
          color: "rgb(158, 85, 156)",
          outline: null,
        },
      },
    ],
    visualVariables: [
      {
        type: "size",
        minDataValue: 600,
        maxDataValue: 4562,
        minSize: 3,
        maxSize: 20,
        valueExpression: "$feature.P2008_D + $feature.P2008_R",
        valueExpressionTitle: "Turnout",
        valueUnit: "unknown",
      },
    ],
  },
});

const electionMap = new Map({
  basemap: {
    portalItem: {
      id: "3582b744bba84668b52a16b0b6942544",
    },
  },
  layers: [electionLayer],
});

const electionViewElement = document.getElementById("electionMapView");
electionViewElement.map = electionMap;
electionViewElement.extent = {
  xmin: -126.902,
  ymin: 23.848,
  xmax: -65.73,
  ymax: 50.15,
};
electionViewElement.constraints = {
  snapToZoom: false,
};

const sliderValue = document.getElementById("sliderValue");
const playButton = document.getElementById("playButton");
const slider = document.getElementById("gapSlider");
let animation = null;

// Label only the two extreme ticks to keep slider text clean.
slider.labelFormatter = function (value, type) {
  if (type === "tick") {
    return value === slider.min ? "Contested" : value === slider.max ? "Landslide" : undefined;
  }
};

slider.addEventListener("calciteSliderInput", () => {
  stopAnimation();
  setGapValue(parseInt(slider.value, 10));
});

playButton.addEventListener("click", () => {
  playButton.iconStart === "pause" ? stopAnimation() : startAnimation();
});

const electionLayerView = await electionViewElement.whenLayerView(electionLayer);
setupHoverTooltip(electionLayerView);
setGapValue(50);

// Applies filter + visual effects based on the selected vote-gap percentage.
function setGapValue(value) {
  sliderValue.textContent = `${(Math.round(value * 100) / 100).toFixed(2)}%`;
  slider.value = value;
  electionLayerView.featureEffect = createEffect(value);
}

function createEffect(gapValue) {
  gapValue = Math.min(100, Math.max(0, gapValue));

  function roundToTheTenth(value) {
    return Math.round(value * 10) / 10;
  }

  return {
    filter: {
      where: `PERCENT_GAP > ${roundToTheTenth(gapValue - 1)} AND PERCENT_GAP < ${roundToTheTenth(gapValue + 1)}`,
    },
    includedEffect: "drop-shadow(0, 2px, 2px, black)",
    excludedEffect: "grayscale(25%) blur(5px) opacity(25%)",
  };
}

function setupHoverTooltip(layerview) {
  let highlight;
  const tooltip = createTooltip();

  // Debounced hitTest avoids overwhelming the view during rapid pointer moves.
  const hitTest = promiseUtils.debounce((point) => {
    return electionViewElement.hitTest(point).then((hit) => {
      const results = hit.results.filter((result) => {
        return result.graphic.layer === electionLayer;
      });

      if (results.length) {
        const graphic = results[0].graphic;
        const screenPoint = hit.screenPoint;

        return {
          graphic: graphic,
          screenPoint: screenPoint,
          values: {
            democrat: Math.round(graphic.getAttribute("P2008_D")),
            republican: Math.round(graphic.getAttribute("P2008_R")),
          },
        };
      }

      return null;
    });
  });

  electionViewElement.addEventListener("arcgisViewPointerMove", async (event) => {
    try {
      const result = await hitTest(event.detail);
      highlight?.remove();

      if (!result) {
        tooltip.hide();
      } else {
        highlight = layerview.highlight(result.graphic);
        tooltip.show(result.screenPoint, result.values);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Unexpected hitTest error:", error);
      }
    }
  });

  electionViewElement.addEventListener("arcgisViewClick", async (event) => {
    const result = await hitTest(event.detail);
    try {
      if (!result) {
        return;
      }

      stopAnimation();

      const dem = result.values.democrat;
      const rep = result.values.republican;
      const p_gap = ((Math.max(dem, rep) - Math.min(dem, rep)) / (dem + rep)) * 100;
      animation = animateTo(p_gap);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Unexpected hitTest error:", error);
      }
    }
  });
}

function startAnimation() {
  stopAnimation();
  animation = animate(slider.value);
  playButton.iconStart = "pause";
  playButton.textContent = "Pause";
}

// Stops either auto-play animation or click-to-target animation.
function stopAnimation() {
  if (!animation) {
    return;
  }

  animation.remove();
  animation = null;
  playButton.iconStart = "play";
  playButton.textContent = "Play";
}

function animate(startValue) {
  let animating = true;
  let value = startValue;
  let direction = 0.1;

  const frame = () => {
    if (!animating) {
      return;
    }

    value += direction;
    if (value > 100) {
      value = 100;
      direction = -direction;
    } else if (value < 0) {
      value = 0;
      direction = -direction;
    }

    setGapValue(value);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return {
    remove: () => {
      animating = false;
    },
  };
}

function animateTo(targetValue) {
  let animating = true;

  const frame = () => {
    if (!animating) {
      return;
    }

    const value = slider.value;
    if (Math.abs(targetValue - value) < 1) {
      animating = false;
      setGapValue(targetValue);
    } else {
      setGapValue(value + (targetValue - value) * 0.25);
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
  return {
    remove: () => {
      animating = false;
    },
  };
}

function createTooltip() {
  const tooltip = document.createElement("div");
  const style = tooltip.style;

  style.opacity = 0;
  tooltip.setAttribute("role", "tooltip");
  tooltip.classList.add("tooltip");

  const content = document.getElementById("tooltipContent");
  content.style.visibility = "visible";
  content.classList.add("esri-widget");
  tooltip.appendChild(content);
  electionViewElement.appendChild(tooltip);

  const demBar = content.querySelector("#chart .row.democrat .bar");
  const demValue = content.querySelector("#chart .row.democrat .value > span");
  const repBar = content.querySelector("#chart .row.republican .bar");
  const repValue = content.querySelector("#chart .row.republican .value > span");
  const gapBar = content.querySelector("#chart .row.gap .bar");
  const gapValue = content.querySelector("#chart .row.gap .value > span");

  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let visible = false;
  let moveRaFTimer;

  function move() {
    // Smoothly follow the pointer so tooltip movement feels less jittery.
    function moveStep() {
      moveRaFTimer = null;
      x += (targetX - x) * 0.5;
      y += (targetY - y) * 0.5;

      if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
        x = targetX;
        y = targetY;
      } else {
        moveRaFTimer = requestAnimationFrame(moveStep);
      }

      style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px, 0)";
    }

    if (!moveRaFTimer) {
      moveRaFTimer = requestAnimationFrame(moveStep);
    }
  }

  let dem;
  let rep;
  let updateRaFTimer;

  function updateContent(values) {
    if (dem === values.democrat && rep === values.republican) {
      return;
    }

    dem = values.democrat;
    rep = values.republican;

    cancelAnimationFrame(updateRaFTimer);
    // Update chart bars in a frame callback to keep UI updates synchronized.
    updateRaFTimer = requestAnimationFrame(() => {
      let p_gap = (Math.max(dem, rep) - Math.min(dem, rep)) / (dem + rep);
      p_gap = Math.round(p_gap * 10000) / 100;

      const p_dem = (dem / (dem + rep)) * 100;
      const p_rep = (rep / (dem + rep)) * 100;

      demBar.style.width = p_dem + "%";
      demValue.textContent = dem;

      repBar.style.width = p_rep + "%";
      repValue.textContent = rep;

      gapBar.style.width = p_gap + "%";
      gapBar.style.marginLeft = Math.min(p_dem, p_rep) + "%";
      gapValue.textContent = p_gap + "%";
    });
  }

  return {
    show: (point, values) => {
      if (!visible) {
        x = point.x;
        y = point.y;
      }

      targetX = point.x;
      targetY = point.y;
      style.opacity = 1;
      visible = true;
      move();
      updateContent(values);
    },
    hide: () => {
      style.opacity = 0;
      visible = false;
    },
  };
}

//--------------------------------------------------------------------------
//  Custom tile scene sample setup
//--------------------------------------------------------------------------

const expand = document.getElementById("colorExpand");
expand.expandIcon = "palette";

// BaseTileLayer subclass that tints OpenTopoMap tiles on the fly.
const TintLayer = BaseTileLayer.createSubclass({
  properties: {
    urlTemplate: null,
    tint: {
      value: null,
      type: Color,
    },
  },

  initialize() {
    // Re-render tiles whenever tint changes from the color picker.
    reactiveUtils.watch(
      () => this.tint,
      () => {
        this.refresh();
      },
    );
  },

  getTileUrl(level, row, col) {
    return this.urlTemplate.replace("{z}", level).replace("{x}", col).replace("{y}", row);
  },

  fetchTile(level, row, col, options) {
    const url = this.getTileUrl(level, row, col);

    return esriRequest(url, {
      responseType: "image",
      signal: options && options.signal,
    }).then((response) => {
      const image = response.data;
      const width = this.tileInfo.size[0];
      const height = this.tileInfo.size[0];

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = width;
      canvas.height = height;

      // Blend selected tint color with the fetched raster tile.
      if (this.tint) {
        context.fillStyle = this.tint.toCss();
        context.fillRect(0, 0, width, height);
        context.globalCompositeOperation = "difference";
      }

      context.drawImage(image, 0, 0, width, height);
      return canvas;
    });
  },
});

const openTopoMapTileLayer = new TintLayer({
  urlTemplate: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
  tint: new Color("#132178"),
  title: "OpenTopoMap",
  copyright:
    'Map data from &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> Map design by &copy; <a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>) contributors',
});

const sceneMap = new Map({
  layers: [openTopoMapTileLayer],
});

const sceneViewElement = document.getElementById("tintSceneView");
sceneViewElement.map = sceneMap;
await sceneViewElement.viewOnReady();

sceneViewElement.environment = {
  lighting: {
    type: "virtual",
  },
};

const colorPicker = document.getElementById("colorPicker");
// Live update tile tint as the picker value changes.
colorPicker.addEventListener("calciteColorPickerChange", () => {
  openTopoMapTileLayer.tint = colorPicker.value;
});
