<template>
  <div>
    <!-- <img id="inspo" src="../../public/inspo.png" alt="Inspiration Apple Map" /> -->
    <div id="comparison-container">
      <div id="before" class="map"></div>
      <div id="after" class="map"></div>
    </div>
    <!-- <div id="before" class="map"></div>
    <div id="after" class="map"></div> -->
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import Compare from "mapbox-gl-compare";
import "mapbox-gl-compare/dist/mapbox-gl-compare.css";

mapboxgl.Compare = Compare;

export default {
  mounted() {
    this.initCompareMap();
  },
  methods: {
    initCompareMap() {
      var start = [-122.2646, 37.4956];

      mapboxgl.accessToken =
        "pk.eyJ1IjoidnByZWxvdmFjIiwiYSI6ImNqYzlqZjZjdDAwMXEyenJ1eDA0ZjJnanAifQ.HfZmaH2OvqcECAIi87A4Vg";
      var before = new mapboxgl.Map({
        container: "before",
        style: "mapbox://styles/dylanc/ckl8wm31u0ao118m4n92vf13g", //"mapbox://styles/dylanc/ckkrw6u900mbb18nzkfntn0t6",

        center: start /*[-110.93475, 32.22396],*/,
        zoom: 10,
        pitch: 15,
        bearing: 5,
        // minZoom:12,
        attributionControl: false
        /*interactive: false,*/
      });

      var after = new mapboxgl.Map({
        container: "after",
        style: "mapbox://styles/vprelovac/cklyc5k0z3vxf17po9xna1cg3",
        center: start /*[-110.93475, 32.22396],*/,
        zoom: 10,
        pitch: 15,
        bearing: 5,
        // minZoom: 12,
        attributionControl: false
        /*interactive: false,*/
      });

      var container = "#comparison-container";

      new mapboxgl.Compare(before, after, container, {
        // mousemove: true, // Optional. Set to true to enable swiping during cursor movement.
        orientation: "vertical" // Optional. Sets the orientation of swiper to horizontal or vertical, defaults to vertical
      });

      // Add zoom and rotation controls to the map.
      var nav = new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: false
      });

      after.addControl(nav, "top-right"); //adds map-navigation controller
    }
  }
};
</script>

<style lang="scss" scoped>
body {
  margin: 0;
  padding: 0;
}
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}

body {
  overflow: hidden;
}

body * {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.map {
  position: absolute;
  top: 80px;
  bottom: 0;
  width: 100%;
}

#inspo {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: auto;
  border: solid 2px grey;
  background-image: cover;
  z-index: 3;
}

.mapboxgl-compare .compare-swiper {
  background-color: grey;
}
</style>
