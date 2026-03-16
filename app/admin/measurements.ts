export const MEASURE_BY_QUANTITY: Record<number, string> = {
  2: "1,58",
  3: "0,56", // DINIZ
  4: "1,58",
  6: "1,13", // DINIZ
  8: "1,67",
  9: "1,69", // DINIZ
  10: "2,22",
  11: "2,26",
  12: "2,26", // DINIZ
  15: "2,82", // DINIZ
  16: "3,33",
  17: "3,37",
  18: "3,39", // DINIZ
  20: "3,89",
  21: "3,95", // DINIZ
  24: "4,52", // DINIZ
  26: "4,79",
  27: "5,09", // DINIZ
  28: "5,55",
  30: "5,65", // DINIZ
  32: "6,10",
  35: "6,71",
  36: "6,87",
  40: "7,76",
  60: "11,32",
}

export function getMeasureForQuantity(quantity: number): string {
  return MEASURE_BY_QUANTITY[quantity] || "N/A"
}

