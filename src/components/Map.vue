<template>
  <div>
    <div id="myMap"></div>
    <button id="testButton" @click="addCustomMarker">add test marker</button>
  </div>
</template>

<script>
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";

import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

export default {
  mounted() {
    this.initializeMap();
  },
  data() {
    return {
      map: null
    };
  },
  methods: {
    addCustomMarker() {
      var el = document.createElement("div");
      el.className = "marker";

      new mapboxgl.Marker({
        element: el,
        anchor: "bottom"
      })
        .setLngLat({
          lng: -122.2646,
          lat: 37.4956
        })
        // .setPopup(
        //   new mapboxgl.Popup({ offset: 25 }) // add popups
        //     .setHTML(
        //       "<h3>" +
        //         marker.properties.title +
        //         "</h3><p>" +
        //         marker.properties.description +
        //         "</p>"
        //     )
        // )
        .addTo(this.map);
      console.log("added marker i hope");
    },
    initializeMap() {
      mapboxgl.accessToken =
        "pk.eyJ1IjoiZHlsYW5jIiwiYSI6Im53UGgtaVEifQ.RJiPqXwEtCLTLl-Vmd1GWQ";
      this.map = new mapboxgl.Map({
        container: "myMap", // container id
        style: "mapbox://styles/dylanc/ckknn6k240hmz17pccv0pun4w", // style URL
        center: [-122.2646, 37.4956], // starting position [lng, lat]
        zoom: 11 // starting zoom
      });

      //Add geocoder
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        // types: "poi",
        // render: function(item) {
        //   // extract the item's maki icon or use a default
        //   var maki = item.properties.maki || "marker";
        //   return (
        //     "<div class='geocoder-dropdown-item'><img class='geocoder-dropdown-icon' src='https://unpkg.com/@mapbox/maki@6.1.0/icons/" +
        //     maki +
        //     "-15.svg'><span class='geocoder-dropdown-text'>" +
        //     item.text +
        //     "</span></div>"
        //   );
        // },
        mapboxgl: mapboxgl,
        marker: false
      });
      this.map.addControl(geocoder, "top-left");

      geocoder.on("result", () => {
        var currentPOI = geocoder.lastSelected;
        console.log("current POI", currentPOI);

        var el = document.createElement("div");
        el.id = "marker-" + currentPOI.id;
        el.className = "marker";

        new mapboxgl.Marker(el, currentPOI)
          .setLngLat({
            lng: currentPOI.geometry.coordinates[0],
            lat: currentPOI.geometry.coordinates[1]
          })
          .addTo(this.map);
      });
      //
    }
  }
};
</script>

<style lang="scss" scoped>
#testButton {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1;
}

#myMap {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background-color: rgb(182, 182, 182);
}
</style>
