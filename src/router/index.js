import Vue from "vue";
import VueRouter from "vue-router";
import Home from "../views/Home.vue";
import Demo from "../views/Demo.vue"

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home
  },
  {
    path: "/demo",
    name: "Demo",
    component: Demo
  },
  {
    path: "/alterations",
    name: "alterations",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/Alterations.vue")
  }
];

const router = new VueRouter({
  routes
});

export default router;
