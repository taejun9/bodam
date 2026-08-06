const moneyFormatter = new Intl.NumberFormat("ko-KR");

export function dateOnlyLabel(value: string): string {
  return `${value.replaceAll("-", ". ")}.`;
}

export function moneyLabel(value: bigint): string {
  return `${moneyFormatter.format(value)}원`;
}

export function bigintDataValue(value: bigint): string {
  return value.toString();
}
