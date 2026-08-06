import { createRouter, createWebHashHistory } from "vue-router";

import CustomerListPage from "@/features/customer/pages/CustomerListPage.vue";
import FamilyListPage from "@/features/family/pages/FamilyListPage.vue";
import CustomerInsurancePage from "@/features/insurance/pages/CustomerInsurancePage.vue";
import SettingsPage from "@/features/settings/pages/SettingsPage.vue";

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
      path: "/families",
      name: "families",
      component: FamilyListPage,
      meta: {
        title: "가족 관리",
        description: "가족 구성원과 합계대상 월보험료를 관리합니다.",
      },
    },
    {
      path: "/customers/:customerId",
      name: "customer-detail",
      component: CustomerInsurancePage,
      meta: {
        title: "고객 상세",
        description: "고객별 보험계약, 보장과 상담 기록을 관리합니다.",
      },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsPage,
      meta: {
        title: "설정",
        description: "고객 보장을 비교할 사용자 설정 기준을 관리합니다.",
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
