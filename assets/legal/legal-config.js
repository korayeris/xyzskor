/**
 * XYZSKOR Yasal Merkez yapılandırması
 * ------------------------------------------------------------
 * Şirket kurulduğunda "Şirket kuruluşundan sonra yayımlanacak" alanlarını
 * doğrulanmış kurumsal bilgilerle değiştirin.
 * Gerçek API anahtarı, şifre veya kimlik belgesi bilgisi yazmayın.
 */
window.XYZ_LEGAL_CONFIG = {
  brandName: "XYZSKOR",
  siteUrl: "https://xyzskor-tr.korayeris2002.chatgpt.site",
  effectiveDate: "Şirket kuruluşundan sonra ilan edilecek",
  version: "Taslak 0.1",

  company: {
    legalName: "XYZSKOR — kuruluş aşamasındaki dijital proje",
    entityType: "Şirket kuruluşundan sonra yayımlanacak",
    responsiblePerson: "Şirket kuruluşundan sonra yayımlanacak",
    taxOffice: "Şirket kuruluşundan sonra yayımlanacak",
    taxNumber: "Şirket kuruluşundan sonra yayımlanacak",
    mersisNumber: "Şirket kuruluşundan sonra yayımlanacak",
    tradeRegistryNumber: "Şirket kuruluşundan sonra yayımlanacak",
    registeredAddress: "Şirket kuruluşundan sonra yayımlanacak",
    phone: "Şirket kuruluşundan sonra yayımlanacak",
    generalEmail: "Şirket kuruluşundan sonra yayımlanacak",
    kvkkEmail: "Şirket kuruluşundan sonra yayımlanacak",
    supportEmail: "Şirket kuruluşundan sonra yayımlanacak",
    pressEmail: "Şirket kuruluşundan sonra yayımlanacak"
  },

  service: {
    minimumAge: "18",
    jurisdictionCity: "Şirket kuruluşundan sonra yayımlanacak",
    predictionLockMinutes: "[ÖRN. 15]",
    accountDeletionDays: "[ÖRN. 30]",
    supportResponseDays: "[ÖRN. 7]"
  },

  infrastructure: {
    hostingProvider: "Supabase",
    hostingRegion: "West EU (Ireland)",
    footballDataProvider: "Sportmonks",
    analyticsProvider: "[KULLANILMIYOR / SAĞLAYICI ADI]",
    errorMonitoringProvider: "[KULLANILMIYOR / SAĞLAYICI ADI]",
    emailProvider: "[KULLANILMIYOR / SAĞLAYICI ADI]",
    pushProvider: "[KULLANILMIYOR / SAĞLAYICI ADI]",
    crossBorderMechanism: "[YAYINDAN ÖNCE HUKUKİ MEKANİZMAYI YAZIN: yeterlilik kararı / standart sözleşme / bağlayıcı şirket kuralları / arızi hâl]"
  },

  retention: {
    account: "[HESAP AKTİF OLDUĞU SÜRE + HUKUKİ SAKLAMA SÜRESİ]",
    securityLogs: "[ÖRN. 2 yıl - hukukçu teyidi gerekli]",
    predictions: "[ÖRN. sezon sonundan itibaren 3 yıl - teyit gerekli]",
    prizeDelivery: "[ÖRN. teslimden itibaren 10 yıl - mali/hukuki teyit gerekli]",
    marketingConsent: "Onay geri çekilene veya yasal saklama süresi dolana kadar",
    applications: "Başvurunun sonuçlanmasından itibaren ilgili mevzuatta öngörülen süre"
  },

  campaign: {
    name: "[KAMPANYA / YARIŞMA ADI]",
    start: "[BAŞLANGIÇ TARİH-SAAT]",
    end: "[BİTİŞ TARİH-SAAT]",
    sponsor: "[ÖDÜL SPONSORU / DÜZENLEYEN]",
    prize: "[ÖDÜLÜN TAM TANIMI VE ADEDİ]",
    approximateValue: "[YAKLAŞIK PİYASA DEĞERİ - GEREKİYORSA]",
    selectionMethod: "Performansa dayalı puan sıralaması",
    announcementChannel: "[SİTE / E-POSTA / SOSYAL MEDYA]",
    winnerResponseHours: "[ÖRN. 72]",
    deliveryDays: "[ÖRN. 30]"
  },

  cookies: [
    {
      name: "xyzskor_consent_v1",
      provider: "XYZSKOR",
      purpose: "Çerez/izleme tercihlerini hatırlamak",
      category: "Zorunlu",
      duration: "12 ay",
      storage: "localStorage"
    },
    {
      name: "X for Websites",
      provider: "X Corp.",
      purpose: "Kullanıcı talep ettiğinde resmî kulüp paylaşımlarını göstermek",
      category: "İşlevsel / üçüncü taraf",
      duration: "X tercih ve politikalarına göre",
      storage: "cookie / benzeri tarayıcı teknolojileri"
    }
  ]
};
