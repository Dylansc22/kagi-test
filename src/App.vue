<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Map</router-link> |
      <router-link to="/alterations">Map Alterations</router-link> | 
      <router-link to="/demo">Routing Issue To Address</router-link>
    </div>
    <router-view />
  </div>
</template>

<style lang="scss">
//popup close button has an ugly border/outline after geocoder marker is first clicked (and popup div is focused) and it looks pretty ugly. Removed it.
.mapboxgl-popup-close-button:focus {
  outline: none;
}

.marker {
  cursor: pointer;
  height: 36px;
  width: 36px;
  background-image: url("../public/Marker2.png");
  background-color: rgba(0, 0, 0, 0);
  background-size: cover;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}
</style>
