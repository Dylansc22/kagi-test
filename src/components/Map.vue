<template>
  <div>
    <div id="map"></div>
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl"; // or "const mapboxgl = require('mapbox-gl');"

export default {
  mounted() {
    this.initializeMap();
  },
  data() {
    return {
      map: null
    }
  },
  methods: {
    initializeMap() {
      mapboxgl.accessToken =
        "pk.eyJ1IjoiZHlsYW5jIiwiYSI6Im53UGgtaVEifQ.RJiPqXwEtCLTLl-Vmd1GWQ";
      this.map = new mapboxgl.Map({
        container: "map", // container id
        style: "mapbox://styles/dylanc/ckknn6k240hmz17pccv0pun4w", // style URL
        center: [-122.2646, 37.4956], // starting position [lng, lat]
        zoom: 11 // starting zoom
      });
    }
  }
};
</script>

<style lang="scss" scoped>
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background-color: rgb(182, 182, 182);
}
</style>
