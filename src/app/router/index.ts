import { createRouter, createWebHashHistory } from "vue-router";

import CustomerListPage from "@/features/customer/pages/CustomerListPage.vue";
import CalendarPage from "@/features/calendar/pages/CalendarPage.vue";
import DashboardPage from "@/features/dashboard/pages/DashboardPage.vue";
import FamilyListPage from "@/features/family/pages/FamilyListPage.vue";
import CustomerInsurancePage from "@/features/insurance/pages/CustomerInsurancePage.vue";
import DataExchangePage from "@/features/data-exchange/pages/DataExchangePage.vue";
import SettingsPage from "@/features/settings/pages/SettingsPage.vue";

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition;
    if (to.path === from.path) return false;
    return { left: 0, top: 0 };
  },
  routes: [
    {
      path: "/",
      redirect: "/dashboard",
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardPage,
      meta: {
        title: "대시보드",
        description: "오늘의 연락과 고객·계약 업무를 한눈에 확인합니다.",
      },
    },
    {
      path: "/calendar",
      name: "calendar",
      component: CalendarPage,
      meta: {
        title: "달력",
        description: "상담·연락·상령·만기와 사용자 일정을 월별로 확인합니다.",
      },
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
      path: "/data-exchange",
      name: "data-exchange",
      component: DataExchangePage,
      meta: {
        title: "데이터 관리",
        description: "계약조회 Excel·CSV 파일을 안전하게 내보내고 가져옵니다.",
      },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsPage,
      meta: {
        title: "설정",
        description: "화면, 대시보드, 백업 위치와 고객 보장 비교 기준을 관리합니다.",
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
