import type {
  DashboardCard,
  DashboardReadModel,
} from "@/features/dashboard/types/dashboard";

const customerIds = [
  "81000000-0000-4000-8000-000000000001",
  "81000000-0000-4000-8000-000000000002",
  "81000000-0000-4000-8000-000000000003",
  "81000000-0000-4000-8000-000000000004",
  "81000000-0000-4000-8000-000000000005",
  "81000000-0000-4000-8000-000000000006",
  "81000000-0000-4000-8000-000000000007",
] as const;

function card<T>(items: readonly T[], totalCount = items.length): DashboardCard<T> {
  return {
    items,
    totalCount,
    isTruncated: totalCount > items.length,
  };
}

export function dashboardModel(label = "A"): DashboardReadModel {
  const longName = `합성고객${label}공백없이아주긴이름으로모바일폭넘침을검증하는문자열`;
  return {
    referenceDate: "2026-08-06",
    referenceInstant: "2026-08-06T03:00:00.000Z",
    timeZone: "Asia/Seoul",
    todayContact: card([{
      customerId: customerIds[0],
      customerName: `합성 연락 고객 ${label}`,
      consultationId: "82000000-0000-4000-8000-000000000001",
      consultedAt: "2026-08-01T03:00:00.000Z",
      nextContactOn: "2026-08-05",
      daysOverdue: 1,
      reason: "다음 연락일이 1일 지났습니다.",
    }]),
    insuranceAge: card([{
      customerId: customerIds[1],
      customerName: longName,
      birthDate: "2000-02-29",
      eventOn: "2026-08-29",
      daysUntil: 23,
      bucket: "0-30",
      insuranceAgeYears: 27,
      reason: "23일 뒤 보험 나이가 27세로 오릅니다.",
    }]),
    maturity: card([{
      customerId: customerIds[2],
      customerName: `합성 만기 고객 ${label}`,
      policyId: "83000000-0000-4000-8000-000000000001",
      insurer: "합성보험사",
      productName: "합성 만기 상품",
      eventOn: "2026-09-20",
      daysUntil: 45,
      bucket: "31-60",
      reason: "45일 뒤 계약이 만기됩니다.",
    }]),
    premiumTop: card([{
      customerId: customerIds[3],
      customerName: `합성 보험료 고객 ${label}`,
      amountWon: 9_007_199_254_740_993n,
      reason: "합계대상 계약의 월보험료입니다.",
    }], 12),
    familyPremium: card([{
      familyId: "84000000-0000-4000-8000-000000000001",
      familyName: `합성 가족 ${label}`,
      memberCount: 2,
      amountWon: 240_000n,
      reason: "활성 구성원 2명의 월보험료 합계입니다.",
    }]),
    coverageInsufficient: card([{
      customerId: customerIds[4],
      customerName: `합성 보장 고객 ${label}`,
      insufficientCategoryCount: 1,
      categories: [{
        categoryId: "85000000-0000-4000-8000-000000000001",
        categoryName: "합성 진단 보장",
        amountWon: 0n,
        adequateMinWon: 50_000_000n,
        shortfallWon: 50_000_000n,
      }],
      reason: "사용자 설정 기준에서 부족한 보장이 1개입니다.",
    }]),
    recentConsultation: card([{
      customerId: customerIds[5],
      customerName: `합성 최근 상담 고객 ${label}`,
      consultationId: "86000000-0000-4000-8000-000000000001",
      consultedAt: "2026-08-06T02:30:00.000Z",
      consultedOn: "2026-08-06",
      daysAgo: 0,
      reason: "오늘 상담했습니다.",
    }]),
    unconsulted: card([{
      customerId: customerIds[6],
      customerName: `합성 미상담 고객 ${label}`,
      latestConsultationId: null,
      latestConsultedAt: null,
      latestConsultedOn: null,
      daysSince: null,
      reason: "상담 기록이 없습니다.",
    }]),
  };
}
