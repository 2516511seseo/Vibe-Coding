export type MealGroup = "convenience" | "korean" | "noodles" | "home" | "dining" | "cafe";
export type MealFilter = "all" | MealGroup;

export const MEAL_FILTERS: { id: MealFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "convenience", label: "편의점·간편" },
  { id: "korean", label: "백반·한식" },
  { id: "noodles", label: "분식·면류" },
  { id: "home", label: "집밥·장보기" },
  { id: "dining", label: "외식·배달" },
  { id: "cafe", label: "카페·간식" },
];

export const MEAL_GROUP_LABELS: Record<MealGroup, string> = {
  convenience: "편의점·간편",
  korean: "백반·한식",
  noodles: "분식·면류",
  home: "집밥·장보기",
  dining: "외식·배달",
  cafe: "카페·간식",
};

export type MealMenuItem = {
  id: string;
  name: string;
  description: string;
  group: MealGroup;
  price: number;
};

export const MEAL_MENU: MealMenuItem[] = [
  { id: "egg-rice", name: "간장계란밥 + 김치·김", description: "밥·계란·김으로 간단히 차리는 한 끼", group: "home", price: 1_600 },
  { id: "toast-milk", name: "식빵 토스트 + 우유", description: "등교 전 빠르게 준비하는 아침", group: "convenience", price: 1_900 },
  { id: "iced-americano", name: "아이스 아메리카노", description: "카페 음료 한 잔", group: "cafe", price: 2_000 },
  { id: "banana-soy", name: "바나나 + 두유 + 삶은 계란", description: "이동 중 간편하게 먹는 조합", group: "convenience", price: 2_400 },
  { id: "tuna-stew", name: "참치김치찌개 + 공깃밥", description: "집에서 두 끼로 나눠 먹기 좋은 찌개", group: "korean", price: 3_200 },
  { id: "bagel", name: "소금빵 또는 베이글", description: "오후 간식이나 가벼운 아침", group: "cafe", price: 3_500 },
  { id: "ramyeon-riceball", name: "컵라면 + 삼각김밥", description: "편의점에서 쉽게 고르는 조합", group: "convenience", price: 3_800 },
  { id: "egg-fried-rice", name: "계란볶음밥", description: "남은 밥과 계란으로 만드는 집밥", group: "home", price: 4_000 },
  { id: "gimbap-soup", name: "김밥 한 줄 + 컵국", description: "수업 사이에 먹기 편한 메뉴", group: "convenience", price: 4_500 },
  { id: "kimchi-rice", name: "김치볶음밥 + 계란", description: "기본 재료로 든든하게", group: "home", price: 4_800 },
  { id: "bibim-noodle", name: "비빔국수", description: "간단한 면 요리 한 그릇", group: "noodles", price: 5_500 },
  { id: "lunchbox", name: "편의점 도시락", description: "밥과 반찬을 한 번에 해결", group: "convenience", price: 5_900 },
  { id: "tteokbokki", name: "떡볶이 + 튀김", description: "친구와 나눠 먹기 좋은 분식", group: "noodles", price: 7_000 },
  { id: "chicken-bowl", name: "치킨마요 덮밥", description: "학교 근처에서 포장하기 쉬운 한 끼", group: "korean", price: 7_500 },
  { id: "jeyuk-rice", name: "제육덮밥", description: "밥과 고기를 함께 먹는 든든한 메뉴", group: "korean", price: 8_500 },
  { id: "gukbap", name: "국밥 한 그릇", description: "따뜻하게 먹는 한식 외식 메뉴", group: "dining", price: 10_000 },
  { id: "pork-cutlet", name: "돈까스 정식", description: "외식 메뉴와 밥·국 포함", group: "dining", price: 12_000 },
  { id: "delivery-pasta", name: "파스타 포장 또는 배달", description: "배달비에 따라 실제 금액이 달라질 수 있어요", group: "dining", price: 14_000 },
];
