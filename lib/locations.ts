export type LocationOption = {
  value: string;
  label: string;
  region: string;
};

export const UZ_REGIONS = [
  { value: "tashkent_city", label: "Toshkent shahri" },
  { value: "tashkent_region", label: "Toshkent viloyati" },
  { value: "andijan", label: "Andijon" },
  { value: "bukhara", label: "Buxoro" },
  { value: "fergana", label: "Farg'ona" },
  { value: "jizzakh", label: "Jizzax" },
  { value: "namangan", label: "Namangan" },
  { value: "navoiy", label: "Navoiy" },
  { value: "qashqadaryo", label: "Qashqadaryo" },
  { value: "samarqand", label: "Samarqand" },
  { value: "sirdaryo", label: "Sirdaryo" },
  { value: "surxondaryo", label: "Surxondaryo" },
  { value: "khorezm", label: "Xorazm" },
  { value: "karakalpakstan", label: "Qoraqalpog'iston" },
] as const;

export const WORK_MODES = ["office", "remote", "hybrid"] as const;

export const UZ_LOCATIONS = UZ_REGIONS.map((region) => ({
  ...region,
  region: "Uzbekistan",
})) satisfies readonly LocationOption[];

export const UZ_CITIES = UZ_REGIONS.map((region) => region.label);
