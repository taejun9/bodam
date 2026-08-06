export function sumFamilyMonthlyPremium(
  memberPremiums: readonly bigint[],
): bigint {
  return memberPremiums.reduce((total, premium) => total + premium, 0n);
}
