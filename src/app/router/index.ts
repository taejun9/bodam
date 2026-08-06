import { createRouter, createWebHashHistory } from "vue-router";

import CustomerListPage from "@/features/customer/pages/CustomerListPage.vue";
import CustomerInsurancePage from "@/features/insurance/pages/CustomerInsurancePage.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/customers",
    },
    {
      path: "/customers",
      name: "customers",
      component: CustomerListPage,
      meta: {
        title: "고객 관리",
        description: "고객 정보와 담당 상태를 한곳에서 관리합니다.",
      },
    },
    {
      path: "/customers/:customerId",
      name: "customer-detail",
      component: CustomerInsurancePage,
      meta: {
        title: "고객 상세",
        description: "고객별 보험계약과 월보험료를 관리합니다.",
      },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/customers",
    },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "BODAM";
  document.title = `${title} · BODAM`;
});

export default router;
