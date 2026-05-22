export type LocationOption = {
  label: string;
  region: string;
};

export const UZ_LOCATIONS = [
  { label: "Remote", region: "Work mode" },
  { label: "Hybrid", region: "Work mode" },
  { label: "Anywhere", region: "Work mode" },

  { label: "Tashkent", region: "Tashkent City" },

  { label: "Nurafshon", region: "Tashkent Region" },
  { label: "Angren", region: "Tashkent Region" },
  { label: "Almalyk", region: "Tashkent Region" },
  { label: "Bekabad", region: "Tashkent Region" },
  { label: "Chirchiq", region: "Tashkent Region" },
  { label: "Ohangaron", region: "Tashkent Region" },
  { label: "Parkent", region: "Tashkent Region" },
  { label: "Yangiyol", region: "Tashkent Region" },
  { label: "Piskent", region: "Tashkent Region" },
  { label: "Gazalkent", region: "Tashkent Region" },

  { label: "Andijan", region: "Andijan Region" },
  { label: "Asaka", region: "Andijan Region" },
  { label: "Khanabad", region: "Andijan Region" },
  { label: "Shahrixon", region: "Andijan Region" },
  { label: "Qorasuv", region: "Andijan Region" },
  { label: "Paxtaobod", region: "Andijan Region" },

  { label: "Bukhara", region: "Bukhara Region" },
  { label: "Gijduvon", region: "Bukhara Region" },
  { label: "Kogon", region: "Bukhara Region" },
  { label: "Qorakol", region: "Bukhara Region" },
  { label: "Vobkent", region: "Bukhara Region" },
  { label: "Romitan", region: "Bukhara Region" },

  { label: "Fergana", region: "Fergana Region" },
  { label: "Kokand", region: "Fergana Region" },
  { label: "Margilan", region: "Fergana Region" },
  { label: "Quvasoy", region: "Fergana Region" },
  { label: "Rishton", region: "Fergana Region" },
  { label: "Quva", region: "Fergana Region" },
  { label: "Beshariq", region: "Fergana Region" },

  { label: "Jizzakh", region: "Jizzakh Region" },
  { label: "Gagarin", region: "Jizzakh Region" },
  { label: "Dashtobod", region: "Jizzakh Region" },
  { label: "Paxtakor", region: "Jizzakh Region" },
  { label: "Zomin", region: "Jizzakh Region" },

  { label: "Namangan", region: "Namangan Region" },
  { label: "Chust", region: "Namangan Region" },
  { label: "Chortoq", region: "Namangan Region" },
  { label: "Kosonsoy", region: "Namangan Region" },
  { label: "Pop", region: "Namangan Region" },
  { label: "Uchqo'rg'on", region: "Namangan Region" },

  { label: "Navoiy", region: "Navoiy Region" },
  { label: "Zarafshan", region: "Navoiy Region" },
  { label: "Uchquduq", region: "Navoiy Region" },
  { label: "Karmana", region: "Navoiy Region" },
  { label: "Qiziltepa", region: "Navoiy Region" },

  { label: "Qarshi", region: "Qashqadaryo Region" },
  { label: "Shahrisabz", region: "Qashqadaryo Region" },
  { label: "Kitob", region: "Qashqadaryo Region" },
  { label: "Koson", region: "Qashqadaryo Region" },
  { label: "Muborak", region: "Qashqadaryo Region" },
  { label: "G'uzor", region: "Qashqadaryo Region" },
  { label: "Yakkabog'", region: "Qashqadaryo Region" },

  { label: "Samarkand", region: "Samarqand Region" },
  { label: "Kattakurgan", region: "Samarqand Region" },
  { label: "Urgut", region: "Samarqand Region" },
  { label: "Bulung'ur", region: "Samarqand Region" },
  { label: "Jomboy", region: "Samarqand Region" },
  { label: "Ishtixon", region: "Samarqand Region" },
  { label: "Payariq", region: "Samarqand Region" },

  { label: "Gulistan", region: "Sirdaryo Region" },
  { label: "Yangiyer", region: "Sirdaryo Region" },
  { label: "Shirin", region: "Sirdaryo Region" },
  { label: "Sardoba", region: "Sirdaryo Region" },
  { label: "Boyovut", region: "Sirdaryo Region" },

  { label: "Termez", region: "Surxondaryo Region" },
  { label: "Denov", region: "Surxondaryo Region" },
  { label: "Sherobod", region: "Surxondaryo Region" },
  { label: "Boysun", region: "Surxondaryo Region" },
  { label: "Jarqo'rg'on", region: "Surxondaryo Region" },
  { label: "Sho'rchi", region: "Surxondaryo Region" },

  { label: "Urgench", region: "Khorezm Region" },
  { label: "Khiva", region: "Khorezm Region" },
  { label: "Pitnak", region: "Khorezm Region" },
  { label: "Gurlan", region: "Khorezm Region" },
  { label: "Hazarasp", region: "Khorezm Region" },
  { label: "Shovot", region: "Khorezm Region" },

  { label: "Nukus", region: "Republic of Karakalpakstan" },
  { label: "Beruniy", region: "Republic of Karakalpakstan" },
  { label: "Chimboy", region: "Republic of Karakalpakstan" },
  { label: "Khojayli", region: "Republic of Karakalpakstan" },
  { label: "Kungrad", region: "Republic of Karakalpakstan" },
  { label: "Mo'ynoq", region: "Republic of Karakalpakstan" },
  { label: "To'rtko'l", region: "Republic of Karakalpakstan" },
] as const satisfies readonly LocationOption[];

export const UZ_CITIES = UZ_LOCATIONS.map((location) => location.label);
