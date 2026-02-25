import {
  categories,
  clients,
  menuProducts,
  menus,
  orderItems,
  orderMenuItems,
  orders,
  products,
  tenants,
  ticketCounters,
  users,
} from "@prepareos/data";
import * as schema from "@prepareos/data/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/store";

console.log("Connecting to database with connection string:", connectionString);

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ============ SEED DATA ============

const CATEGORIES = [
  {
    name: "Fromages à pâte molle",
    description:
      "Fromages onctueux à croûte fleurie ou lavée. Texture crémeuse et fondante.",
    color: "#F97316", // Orange
    sortOrder: 1,
  },
  {
    name: "Fromages à pâte pressée",
    description: "Fromages à la texture ferme, affinés pendant plusieurs mois.",
    color: "#EAB308", // Yellow
    sortOrder: 2,
  },
  {
    name: "Fromages à pâte persillée",
    description: "Fromages bleus avec des veines de moisissures nobles.",
    color: "#3B82F6", // Blue
    sortOrder: 3,
  },
  {
    name: "Fromages de chèvre",
    description:
      "Fromages au lait de chèvre, frais ou affinés. Du plus doux au plus corsé.",
    color: "#22C55E", // Green
    sortOrder: 4,
  },
  {
    name: "Fromages frais",
    description:
      "Fromages non affinés, doux et légers. Parfaits pour les desserts.",
    color: "#14B8A6", // Turquoise
    sortOrder: 5,
  },
  {
    name: "Accompagnements",
    description: "Pain, crackers, fruits secs et autres accompagnements.",
    color: "#6B7280", // Gray
    sortOrder: 6,
  },
];

// Staff members to seed
const STAFF = [
  {
    id: "staff-1",
    name: "Marie Dupont",
    email: "marie@fromagerie.local",
    pin: "1234",
    role: "owner" as const,
    isActive: true,
  },
  {
    id: "staff-2",
    name: "Jean Martin",
    email: "jean@fromagerie.local",
    pin: "5678",
    role: "staff" as const,
    isActive: true,
  },
  {
    id: "staff-3",
    name: "Sophie Bernard",
    email: "sophie@fromagerie.local",
    pin: "9012",
    role: "staff" as const,
    isActive: true,
  },
  {
    id: "staff-4",
    name: "Pierre Lefebvre",
    email: "pierre@fromagerie.local",
    pin: "3456",
    role: "admin" as const,
    isActive: true,
  },
];

// Clients to seed
const CLIENTS = [
  {
    name: "Restaurant Le Gourmet",
    phone: "01 42 33 44 55",
    email: "contact@legourmet.fr",
    notes: "Commande tous les lundis - livraison mardi matin",
  },
  {
    name: "Hôtel du Parc",
    phone: "01 45 67 89 00",
    email: "cuisine@hotelduparc.fr",
    notes: "Plateau fromages pour petit-déjeuner - compte entreprise",
  },
  {
    name: "Famille Moreau",
    phone: "06 12 34 56 78",
    email: "moreau.famille@email.com",
    notes: "Client fidèle - préfère les fromages de chèvre",
  },
  {
    name: "Traiteur Delices",
    phone: "01 55 66 77 88",
    email: "commandes@traiteurdelices.fr",
    notes: "Grosses commandes pour événements",
  },
  {
    name: "Cave à Vins Saint-Michel",
    phone: "01 33 44 55 66",
    email: "contact@cave-st-michel.fr",
    notes: "Accord vin-fromage - commandes régulières",
  },
  {
    name: "Mme Dubois",
    phone: "06 98 76 54 32",
    email: null,
    notes: "Cliente régulière - appelle pour commander",
  },
  {
    name: "Bistrot du Coin",
    phone: "01 22 33 44 55",
    email: "bistrot.coin@resto.fr",
    notes: "Plateau apéritif hebdomadaire",
  },
  {
    name: "M. Laurent",
    phone: "06 11 22 33 44",
    email: "jlaurent@email.com",
    notes: "Amateur de Roquefort et bleus",
  },
];

const PRODUCTS: Array<{
  name: string;
  description: string;
  price: string;
  categoryIndex: number;
  sortOrder: number;
  stock: string | null;
  imageUrl: string;
  unitType?: "piece" | "kg";
}> = [
  // Pâte molle (index 0)
  {
    name: "Camembert de Normandie AOP",
    description:
      "Camembert au lait cru, affiné 21 jours minimum. Onctueux et savoureux.",
    price: "8.50",
    categoryIndex: 0,
    sortOrder: 1,
    stock: "12",
    imageUrl: "https://picsum.photos/seed/camembert/400/300",
  },
  {
    name: "Brie de Meaux AOP",
    description:
      "Le roi des fromages. Pâte souple et crémeuse, croûte fine et fleurie.",
    price: "12.90",
    categoryIndex: 0,
    sortOrder: 2,
    stock: "5",
    imageUrl: "https://picsum.photos/seed/brie/400/300",
  },
  {
    name: "Époisses AOP",
    description:
      "Fromage à croûte lavée au Marc de Bourgogne. Puissant et crémeux.",
    price: "14.50",
    categoryIndex: 0,
    sortOrder: 3,
    stock: "3",
    imageUrl: "https://picsum.photos/seed/epoisses/400/300",
  },
  {
    name: "Mont d'Or AOP",
    description:
      "Fromage saisonnier dans sa boîte en épicéa. À déguster à la cuillère.",
    price: "18.90",
    categoryIndex: 0,
    sortOrder: 4,
    stock: "0",
    imageUrl: "https://picsum.photos/seed/montdor/400/300",
  },
  {
    name: "Reblochon de Savoie AOP",
    description:
      "Fromage savoyard onctueux. Indispensable pour la tartiflette.",
    price: "9.80",
    categoryIndex: 0,
    sortOrder: 5,
    stock: "8",
    imageUrl: "https://picsum.photos/seed/reblochon/400/300",
  },

  // Pâte pressée (index 1)
  {
    name: "Comté AOP 18 mois",
    description:
      "Affinage long pour des arômes intenses de fruits secs et de noisette.",
    price: "24.90",
    categoryIndex: 1,
    sortOrder: 1,
    stock: "15",
    imageUrl: "https://picsum.photos/seed/comte18/400/300",
  },
  {
    name: "Comté AOP 36 mois",
    description:
      "Exceptionnelle complexité aromatique. Cristaux de tyrosine présents.",
    price: "38.50",
    categoryIndex: 1,
    sortOrder: 2,
    stock: "2",
    imageUrl: "https://picsum.photos/seed/comte36/400/300",
  },
  {
    name: "Beaufort d'été AOP",
    description:
      "Fromage des alpages, au lait des vaches broutant les fleurs d'altitude.",
    price: "32.00",
    categoryIndex: 1,
    sortOrder: 3,
    stock: "4",
    imageUrl: "https://picsum.photos/seed/beaufort/400/300",
  },
  {
    name: "Tomme de Savoie IGP",
    description:
      "Fromage de montagne à la croûte grise. Saveur douce et fruitée.",
    price: "16.50",
    categoryIndex: 1,
    sortOrder: 4,
    stock: "10",
    imageUrl: "https://picsum.photos/seed/tomme/400/300",
  },
  {
    name: "Cantal Entre-Deux AOP",
    description:
      "Affinage de 3 à 7 mois. Équilibre parfait entre douceur et caractère.",
    price: "14.90",
    categoryIndex: 1,
    sortOrder: 5,
    stock: "7",
    imageUrl: "https://picsum.photos/seed/cantal/400/300",
  },
  {
    name: "Ossau-Iraty AOP",
    description:
      "Fromage basque au lait de brebis. Notes de noisette et de caramel.",
    price: "22.50",
    categoryIndex: 1,
    sortOrder: 6,
    stock: "6",
    imageUrl: "https://picsum.photos/seed/ossau/400/300",
  },

  // Pâte persillée (index 2)
  {
    name: "Roquefort AOP",
    description:
      "Le roi des bleus. Affiné dans les caves de Roquefort-sur-Soulzon.",
    price: "26.90",
    categoryIndex: 2,
    sortOrder: 1,
    stock: "9",
    imageUrl: "https://picsum.photos/seed/roquefort/400/300",
  },
  {
    name: "Bleu d'Auvergne AOP",
    description: "Persillé équilibré et crémeux. Plus doux que le Roquefort.",
    price: "18.50",
    categoryIndex: 2,
    sortOrder: 2,
    stock: "0",
    imageUrl: "https://picsum.photos/seed/bleuauvergne/400/300",
  },
  {
    name: "Fourme d'Ambert AOP",
    description:
      "Le plus doux des bleus français. Texture fondante et goût délicat.",
    price: "16.90",
    categoryIndex: 2,
    sortOrder: 3,
    stock: "4",
    imageUrl: "https://picsum.photos/seed/fourme/400/300",
  },
  {
    name: "Bleu de Gex AOP",
    description: "Bleu du Jura à la saveur subtile et légèrement amère.",
    price: "19.50",
    categoryIndex: 2,
    sortOrder: 4,
    stock: "1",
    imageUrl: "https://picsum.photos/seed/bleugex/400/300",
  },

  // Chèvre (index 3)
  {
    name: "Crottin de Chavignol AOP",
    description: "Petit fromage de chèvre du Berry. Du plus frais au plus sec.",
    price: "4.50",
    categoryIndex: 3,
    sortOrder: 1,
    stock: "20",
    imageUrl: "https://picsum.photos/seed/crottin/400/300",
  },
  {
    name: "Sainte-Maure de Touraine AOP",
    description:
      "Bûche cendrée traversée d'une paille de seigle. Onctueux et typé.",
    price: "8.90",
    categoryIndex: 3,
    sortOrder: 2,
    stock: "8",
    imageUrl: "https://picsum.photos/seed/saintemaure/400/300",
  },
  {
    name: "Valençay AOP",
    description:
      "Pyramide tronquée cendrée. Légende napoléonienne et goût délicat.",
    price: "9.50",
    categoryIndex: 3,
    sortOrder: 3,
    stock: "5",
    imageUrl: "https://picsum.photos/seed/valencay/400/300",
  },
  {
    name: "Rocamadour AOP",
    description: "Petit palet du Quercy. Doux et crémeux quand il est jeune.",
    price: "3.90",
    categoryIndex: 3,
    sortOrder: 4,
    stock: "15",
    imageUrl: "https://picsum.photos/seed/rocamadour/400/300",
  },
  {
    name: "Picodon AOP",
    description: "Petit fromage ardéchois au goût prononcé. Affiné en cave.",
    price: "4.20",
    categoryIndex: 3,
    sortOrder: 5,
    stock: "10",
    imageUrl: "https://picsum.photos/seed/camembert/400/300",
  },

  // Fromages frais (index 4)
  {
    name: "Faisselle fermière",
    description:
      "Fromage frais en faisselle. Léger et rafraîchissant avec du miel.",
    price: "4.50",
    categoryIndex: 4,
    sortOrder: 1,
    stock: "6",
    imageUrl: "https://picsum.photos/seed/faisselle/400/300",
  },
  {
    name: "Brousse du Rove",
    description: "Fromage frais au lait de chèvre du Rove. Texture aérienne.",
    price: "6.90",
    categoryIndex: 4,
    sortOrder: 2,
    stock: "3",
    imageUrl: "https://picsum.photos/seed/brousse/400/300",
  },
  {
    name: "Fontainebleau",
    description:
      "Fromage frais battu à la crème. Dessert gourmand avec des fruits.",
    price: "5.50",
    categoryIndex: 4,
    sortOrder: 3,
    stock: "8",
    imageUrl: "https://picsum.photos/seed/fontainebleau/400/300",
  },
  {
    name: "Cervelle de Canut",
    description: "Spécialité lyonnaise au fromage blanc, herbes et échalotes.",
    price: "5.90",
    categoryIndex: 4,
    sortOrder: 4,
    stock: "4",
    imageUrl: "https://picsum.photos/seed/brie/400/300",
  },

  // Accompagnements (index 5) — stock not tracked for these
  {
    name: "Pain aux noix artisanal",
    description: "Pain rustique aux noix, parfait avec les fromages.",
    price: "4.50",
    categoryIndex: 5,
    sortOrder: 1,
    stock: null,
    imageUrl: "https://picsum.photos/seed/painnoix/400/300",
  },
  {
    name: "Crackers aux graines",
    description: "Assortiment de crackers aux graines de lin et sésame.",
    price: "3.90",
    categoryIndex: 5,
    sortOrder: 2,
    stock: null,
    imageUrl: "https://picsum.photos/seed/crackers/400/300",
  },
  {
    name: "Confiture de figues",
    description: "Confiture artisanale de figues. Accord parfait avec le bleu.",
    price: "6.50",
    categoryIndex: 5,
    sortOrder: 3,
    stock: null,
    imageUrl: "https://picsum.photos/seed/confiture/400/300",
  },
  {
    name: "Miel de montagne",
    description: "Miel toutes fleurs des Pyrénées. Pour les chèvres frais.",
    price: "8.90",
    categoryIndex: 5,
    sortOrder: 4,
    stock: null,
    imageUrl: "https://picsum.photos/seed/miel/400/300",
  },
  {
    name: "Fruits secs assortis",
    description: "Mélange de noix, noisettes, amandes et abricots secs.",
    price: "7.50",
    categoryIndex: 5,
    sortOrder: 5,
    stock: null,
    imageUrl: "https://picsum.photos/seed/fruitssecs/400/300",
  },
  {
    name: "Beurre de baratte AOP",
    description: "Beurre doux de baratte, fabrication artisanale. Vendu au poids.",
    price: "18.50",
    categoryIndex: 5,
    sortOrder: 6,
    stock: "5.000",
    imageUrl: "https://picsum.photos/seed/beurre/400/300",
    unitType: "kg",
  },
  {
    name: "Lait cru fermier",
    description: "Lait cru entier de vache, directement de la ferme. Vendu au litre (kg).",
    price: "2.80",
    categoryIndex: 5,
    sortOrder: 7,
    stock: "12.000",
    imageUrl: "https://picsum.photos/seed/laitcru/400/300",
    unitType: "kg",
  },
];

const MENUS: Array<{
  name: string;
  description: string;
  productNames: string[];
  sortOrder: number;
}> = [
  {
    name: "Plateau Découverte",
    description:
      "5 fromages pour découvrir les grandes familles. Idéal pour débuter.",
    productNames: [
      "Camembert de Normandie AOP",
      "Comté AOP 18 mois",
      "Roquefort AOP",
      "Crottin de Chavignol AOP",
      "Pain aux noix artisanal",
    ],
    sortOrder: 1,
  },
  {
    name: "Plateau Dégustation Premium",
    description:
      "Sélection de 7 fromages d'exception pour les amateurs avertis.",
    productNames: [
      "Brie de Meaux AOP",
      "Époisses AOP",
      "Comté AOP 36 mois",
      "Beaufort d'été AOP",
      "Roquefort AOP",
      "Sainte-Maure de Touraine AOP",
      "Fruits secs assortis",
    ],
    sortOrder: 2,
  },
  {
    name: "Plateau Chèvre",
    description:
      "Tour de France des fromages de chèvre. 5 terroirs, 5 saveurs.",
    productNames: [
      "Crottin de Chavignol AOP",
      "Sainte-Maure de Touraine AOP",
      "Valençay AOP",
      "Rocamadour AOP",
      "Picodon AOP",
      "Miel de montagne",
    ],
    sortOrder: 3,
  },
  {
    name: "Plateau Montagne",
    description:
      "Les fromages des alpages. Comté, Beaufort, Tomme et Reblochon.",
    productNames: [
      "Comté AOP 18 mois",
      "Beaufort d'été AOP",
      "Tomme de Savoie IGP",
      "Reblochon de Savoie AOP",
      "Pain aux noix artisanal",
    ],
    sortOrder: 4,
  },
  {
    name: "Plateau Bleus",
    description:
      "Pour les amateurs de persillés. Du plus doux au plus intense.",
    productNames: [
      "Fourme d'Ambert AOP",
      "Bleu d'Auvergne AOP",
      "Bleu de Gex AOP",
      "Roquefort AOP",
      "Confiture de figues",
    ],
    sortOrder: 5,
  },
  {
    name: "Apéro Fromager",
    description:
      "Sélection légère pour l'apéritif. Fromages et accompagnements.",
    productNames: [
      "Rocamadour AOP",
      "Crottin de Chavignol AOP",
      "Comté AOP 18 mois",
      "Crackers aux graines",
      "Fruits secs assortis",
    ],
    sortOrder: 6,
  },
];

const today = new Date();
today.setHours(0, 0, 0, 0);

// Menu orders — orders that include at least one menu
type MenuOrderItem = { menuName: string; quantity: number };
type ProductOrderItem = {
  productName: string;
  price: string;
  quantity: number;
  unit?: "piece" | "kg";
};
type SampleOrderItem = ProductOrderItem | MenuOrderItem;
function isMenuOrderItem(item: SampleOrderItem): item is MenuOrderItem {
  return "menuName" in item;
}

type SeedOrder = {
  items: SampleOrderItem[];
  paymentStatus: "pending" | "paid" | "partially_paid" | "refunded";
  preparationStatus: "pending" | "in_preparation" | "ready" | "picked_up";
  clientNote?: string;
  pickupTimeStart?: string;
  pickupTimeEnd?: string;
  pickupDate?: Date;
};

const MENU_ORDERS: SeedOrder[] = [
  {
    items: [{ menuName: "Plateau Découverte", quantity: 1 }],
    paymentStatus: "paid",
    preparationStatus: "pending",
    clientNote: "Plateau pour 4 personnes ce soir",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { menuName: "Plateau Dégustation Premium", quantity: 1 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Commande VIP - soirée dégustation",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [{ menuName: "Plateau Chèvre", quantity: 2 }],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "2 plateaux chèvre pour buffet",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { menuName: "Plateau Montagne", quantity: 1 },
      { menuName: "Apéro Fromager", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Pour soirée entre amis",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { menuName: "Plateau Bleus", quantity: 1 },
      { productName: "Confiture de figues", price: "6.50", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Amateur de bleus - accompagnement supplémentaire",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [{ menuName: "Apéro Fromager", quantity: 3 }],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "3 plateaux apéro pour événement d'entreprise",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { menuName: "Plateau Découverte", quantity: 1 },
      { menuName: "Plateau Bleus", quantity: 1 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "2 plateaux différents pour soirée découverte",
  },
  {
    items: [{ menuName: "Plateau Dégustation Premium", quantity: 2 }],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "Commande traiteur - 2 plateaux premium",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
];

// Sample orders data
const SAMPLE_ORDERS: SeedOrder[] = [
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 2 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Pour un plateau apéritif",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Roquefort AOP", price: "26.90", quantity: 1 },
      { productName: "Fourme d'Ambert AOP", price: "16.90", quantity: 1 },
      { productName: "Confiture de figues", price: "6.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Amateur de bleus",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 1 },
      { productName: "Époisses AOP", price: "14.50", quantity: 1 },
      { productName: "Mont d'Or AOP", price: "18.90", quantity: 1 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Prévoir cuillère pour le Mont d'Or",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 4 },
      {
        productName: "Sainte-Maure de Touraine AOP",
        price: "8.90",
        quantity: 2,
      },
      { productName: "Miel de montagne", price: "8.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Soirée chèvre entre amis",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Comté AOP 36 mois", price: "38.50", quantity: 1 },
      { productName: "Beaufort d'été AOP", price: "32.00", quantity: 1 },
      { productName: "Ossau-Iraty AOP", price: "22.50", quantity: 1 },
      { productName: "Fruits secs assortis", price: "7.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Commande premium - cadeau d'affaires",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Faisselle fermière", price: "4.50", quantity: 2 },
      { productName: "Brousse du Rove", price: "6.90", quantity: 1 },
      { productName: "Fontainebleau", price: "5.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Desserts pour repas de famille",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Reblochon de Savoie AOP", price: "9.80", quantity: 3 },
      { productName: "Tomme de Savoie IGP", price: "16.50", quantity: 1 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Pour faire une tartiflette - récupération samedi",
  },
  {
    items: [
      { productName: "Rocamadour AOP", price: "3.90", quantity: 6 },
      { productName: "Picodon AOP", price: "4.20", quantity: 4 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  // ---- Extra orders for pagination testing ----
  {
    items: [
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 1 },
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Commande régulière du mardi",
  },
  {
    items: [
      { productName: "Roquefort AOP", price: "26.90", quantity: 2 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Pour le restaurant - table 12",
  },
  {
    items: [
      { productName: "Époisses AOP", price: "14.50", quantity: 1 },
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 2 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Retrait prévu vendredi matin",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Ossau-Iraty AOP", price: "22.50", quantity: 1 },
      { productName: "Cantal Entre-Deux AOP", price: "14.90", quantity: 1 },
      { productName: "Miel de montagne", price: "8.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Plateau pour soirée vin-fromage",
  },
  {
    items: [
      { productName: "Valençay AOP", price: "9.50", quantity: 2 },
      { productName: "Rocamadour AOP", price: "3.90", quantity: 4 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Chèvres assortis pour apéro",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Beaufort d'été AOP", price: "32.00", quantity: 1 },
      { productName: "Tomme de Savoie IGP", price: "16.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Cadeau anniversaire",
  },
  {
    items: [
      { productName: "Cervelle de Canut", price: "5.90", quantity: 3 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Entrée pour dîner lyonnais",
  },
  {
    items: [
      { productName: "Fourme d'Ambert AOP", price: "16.90", quantity: 1 },
      { productName: "Bleu de Gex AOP", price: "19.50", quantity: 1 },
      { productName: "Confiture de figues", price: "6.50", quantity: 2 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Dégustation de bleus",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [
      { productName: "Reblochon de Savoie AOP", price: "9.80", quantity: 4 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Pour tartiflette de 8 personnes",
  },
  {
    items: [
      { productName: "Comté AOP 36 mois", price: "38.50", quantity: 1 },
      { productName: "Fruits secs assortis", price: "7.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Cadeau client VIP",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Faisselle fermière", price: "4.50", quantity: 3 },
      { productName: "Fontainebleau", price: "5.50", quantity: 3 },
      { productName: "Miel de montagne", price: "8.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Desserts brunch du dimanche",
  },
  {
    items: [
      { productName: "Picodon AOP", price: "4.20", quantity: 6 },
      {
        productName: "Sainte-Maure de Touraine AOP",
        price: "8.90",
        quantity: 2,
      },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Chèvres pour salade composée",
  },
  {
    items: [
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 3 },
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 1 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Pâtes molles pour buffet",
  },
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 2 },
      { productName: "Beaufort d'été AOP", price: "32.00", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Commande mensuelle M. Laurent",
  },
  {
    items: [
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 8 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Crottins chauds pour salade",
  },
  {
    items: [
      { productName: "Roquefort AOP", price: "26.90", quantity: 1 },
      { productName: "Bleu d'Auvergne AOP", price: "18.50", quantity: 1 },
      { productName: "Fourme d'Ambert AOP", price: "16.90", quantity: 1 },
      { productName: "Bleu de Gex AOP", price: "19.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Plateau tout-bleu pour anniversaire",
  },
  {
    items: [
      { productName: "Brousse du Rove", price: "6.90", quantity: 2 },
      { productName: "Faisselle fermière", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Frais du jour",
  },
  {
    items: [
      { productName: "Mont d'Or AOP", price: "18.90", quantity: 2 },
      { productName: "Reblochon de Savoie AOP", price: "9.80", quantity: 2 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Soirée raclette / fondue entre amis",
  },
  {
    items: [
      { productName: "Tomme de Savoie IGP", price: "16.50", quantity: 2 },
      { productName: "Cantal Entre-Deux AOP", price: "14.90", quantity: 2 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 3 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Plateau montagne pour randonnée",
  },
  {
    items: [
      { productName: "Époisses AOP", price: "14.50", quantity: 2 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Croûtes lavées pour dégustation",
  },
  {
    items: [
      {
        productName: "Sainte-Maure de Touraine AOP",
        price: "8.90",
        quantity: 3,
      },
      { productName: "Valençay AOP", price: "9.50", quantity: 2 },
      { productName: "Picodon AOP", price: "4.20", quantity: 3 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Tour de Loire en fromages de chèvre",
  },
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
      { productName: "Ossau-Iraty AOP", price: "22.50", quantity: 1 },
      { productName: "Roquefort AOP", price: "26.90", quantity: 1 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 1 },
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Plateau prestige 5 familles",
  },
  {
    items: [
      { productName: "Fontainebleau", price: "5.50", quantity: 4 },
      { productName: "Confiture de figues", price: "6.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Desserts pour garden party",
  },
  {
    items: [
      { productName: "Comté AOP 36 mois", price: "38.50", quantity: 2 },
      { productName: "Beaufort d'été AOP", price: "32.00", quantity: 1 },
      { productName: "Ossau-Iraty AOP", price: "22.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Sélection pâtes pressées haut de gamme",
  },
  {
    items: [
      { productName: "Rocamadour AOP", price: "3.90", quantity: 10 },
      { productName: "Miel de montagne", price: "8.90", quantity: 2 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Rocamadour au miel pour cocktail",
  },
  {
    items: [
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 2 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 3 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Brie entier pour mariage",
  },
  {
    items: [
      { productName: "Cervelle de Canut", price: "5.90", quantity: 2 },
      { productName: "Brousse du Rove", price: "6.90", quantity: 1 },
      { productName: "Faisselle fermière", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Fromages frais pour terrasse",
  },
  {
    items: [
      { productName: "Bleu d'Auvergne AOP", price: "18.50", quantity: 2 },
      { productName: "Fourme d'Ambert AOP", price: "16.90", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Bleus d'Auvergne pour le restaurant",
  },
  {
    items: [
      { productName: "Cantal Entre-Deux AOP", price: "14.90", quantity: 3 },
      { productName: "Tomme de Savoie IGP", price: "16.50", quantity: 1 },
      { productName: "Fruits secs assortis", price: "7.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Panier cadeau entreprise",
  },
  {
    items: [
      { productName: "Époisses AOP", price: "14.50", quantity: 1 },
      { productName: "Mont d'Or AOP", price: "18.90", quantity: 1 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Fromages forts pour amateur averti",
  },
  {
    items: [
      { productName: "Reblochon de Savoie AOP", price: "9.80", quantity: 6 },
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Tartiflette géante - fête des voisins",
  },
  {
    items: [
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 3 },
      { productName: "Rocamadour AOP", price: "3.90", quantity: 3 },
      { productName: "Picodon AOP", price: "4.20", quantity: 3 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Mini chèvres variés pour buffet",
  },
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
      { productName: "Roquefort AOP", price: "26.90", quantity: 1 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Les classiques de la semaine",
  },
  {
    items: [
      {
        productName: "Sainte-Maure de Touraine AOP",
        price: "8.90",
        quantity: 1,
      },
      { productName: "Valençay AOP", price: "9.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Loire duo",
  },
  {
    items: [
      { productName: "Beaufort d'été AOP", price: "32.00", quantity: 2 },
      { productName: "Comté AOP 36 mois", price: "38.50", quantity: 1 },
      { productName: "Ossau-Iraty AOP", price: "22.50", quantity: 1 },
      { productName: "Fruits secs assortis", price: "7.50", quantity: 3 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Grosse commande traiteur - 50 couverts",
  },
  {
    items: [
      { productName: "Fontainebleau", price: "5.50", quantity: 2 },
      { productName: "Brousse du Rove", price: "6.90", quantity: 2 },
      { productName: "Miel de montagne", price: "8.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Frais et léger pour l'été",
  },
  {
    items: [
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 1 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 1 },
      { productName: "Reblochon de Savoie AOP", price: "9.80", quantity: 1 },
      { productName: "Époisses AOP", price: "14.50", quantity: 1 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
    clientNote: "Sélection pâtes molles complète",
  },
  {
    items: [
      { productName: "Bleu de Gex AOP", price: "19.50", quantity: 2 },
      { productName: "Confiture de figues", price: "6.50", quantity: 1 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Bleu du Jura et accompagnements",
  },
  {
    items: [{ productName: "Cervelle de Canut", price: "5.90", quantity: 4 }],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Spécialité Lyon pour bouchon",
  },
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 3 },
      { productName: "Tomme de Savoie IGP", price: "16.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Réassort cave à fromages",
  },
  {
    items: [
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 6 },
      { productName: "Miel de montagne", price: "8.90", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Crottins mi-secs au miel",
  },
  {
    items: [
      { productName: "Mont d'Or AOP", price: "18.90", quantity: 3 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Mont d'Or au four pour groupe",
  },
  {
    items: [
      { productName: "Picodon AOP", price: "4.20", quantity: 5 },
      {
        productName: "Sainte-Maure de Touraine AOP",
        price: "8.90",
        quantity: 1,
      },
      { productName: "Valençay AOP", price: "9.50", quantity: 1 },
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Grand plateau chèvre pour 12 personnes",
  },
  {
    items: [
      { productName: "Roquefort AOP", price: "26.90", quantity: 1 },
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
      { productName: "Brie de Meaux AOP", price: "12.90", quantity: 1 },
      { productName: "Crottin de Chavignol AOP", price: "4.50", quantity: 2 },
      { productName: "Crackers aux graines", price: "3.90", quantity: 1 },
      { productName: "Confiture de figues", price: "6.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Plateau complet 5 familles + accompagnements",
  },
  // ---- Orders with kg products ----
  {
    items: [
      { productName: "Beurre de baratte AOP", price: "18.50", quantity: 0.5, unit: "kg" as const },
      { productName: "Lait cru fermier", price: "2.80", quantity: 2, unit: "kg" as const },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "pending" as const,
    clientNote: "Pour recette de gâteau breton",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Beurre de baratte AOP", price: "18.50", quantity: 0.25, unit: "kg" as const },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 1 },
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
    ],
    paymentStatus: "pending" as const,
    preparationStatus: "in_preparation" as const,
    clientNote: "Beurre pour tartines + fromage plateau",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [
      { productName: "Lait cru fermier", price: "2.80", quantity: 3, unit: "kg" as const },
      { productName: "Faisselle fermière", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "ready" as const,
    clientNote: "Lait pour fabrication fromage maison",
  },
];

// ============ SEED FUNCTIONS ============

async function seedTenant(): Promise<string> {
  console.log("🏢 Seeding tenant...");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Fromagerie du Quartier",
      slug: "fromagerie",
    })
    .onConflictDoUpdate({
      target: tenants.slug,
      set: { name: "Fromagerie du Quartier" },
    })
    .returning();

  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`);
  return tenant.id;
}

async function clearDatabase() {
  console.log("🗑️  Clearing existing data...");
  await db.delete(orderMenuItems);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(ticketCounters);
  await db.delete(menuProducts);
  await db.delete(menus);
  await db.delete(products);
  await db.delete(categories);
  await db.delete(clients);
  // Don't delete users with BetterAuth accounts, only seed users
  // We'll upsert staff instead
  console.log("✅ Database cleared");
}

async function seedCategories(tenantId: string) {
  console.log("📁 Seeding categories...");
  const inserted = await db
    .insert(categories)
    .values(CATEGORIES.map((c) => ({ ...c, tenantId })))
    .returning();
  console.log(`✅ Created ${inserted.length} categories`);
  return inserted;
}

async function seedProducts(
  tenantId: string,
  categoryList: (typeof categories.$inferSelect)[],
) {
  console.log("🧀 Seeding products...");
  const productsToInsert = PRODUCTS.map((p) => ({
    name: p.name,
    description: p.description,
    price: p.price,
    categoryId: categoryList[p.categoryIndex]?.id ?? null,
    sortOrder: p.sortOrder,
    stock: p.stock,
    imageUrl: p.imageUrl,
    unitType: p.unitType ?? ("piece" as const),
    isActive: true,
    tenantId,
  }));

  const inserted = await db
    .insert(products)
    .values(productsToInsert)
    .returning();
  console.log(`✅ Created ${inserted.length} products`);
  return inserted;
}

async function seedMenus(
  tenantId: string,
  productList: (typeof products.$inferSelect)[],
) {
  console.log("📋 Seeding menus...");

  const productMap = new Map(productList.map((p) => [p.name, p.id]));
  const insertedMenus = [];

  for (const menuData of MENUS) {
    const [menu] = await db
      .insert(menus)
      .values({
        name: menuData.name,
        description: menuData.description,
        sortOrder: menuData.sortOrder,
        isActive: true,
        tenantId,
      })
      .returning();

    insertedMenus.push(menu);

    // Add products to menu
    const menuProductsToInsert = menuData.productNames
      .map((productName, index) => {
        const productId = productMap.get(productName);
        if (!productId) {
          console.warn(`⚠️  Product not found: ${productName}`);
          return null;
        }
        return {
          menuId: menu.id,
          productId,
          sortOrder: index,
        };
      })
      .filter(Boolean) as {
      menuId: string;
      productId: string;
      sortOrder: number;
    }[];

    if (menuProductsToInsert.length > 0) {
      await db.insert(menuProducts).values(menuProductsToInsert);
    }
  }

  console.log(`✅ Created ${insertedMenus.length} menus`);
  return insertedMenus;
}

async function seedOrders(
  tenantId: string,
  productList: (typeof products.$inferSelect)[],
  menuList: (typeof menus.$inferSelect)[],
  clientList: (typeof clients.$inferSelect)[],
) {
  console.log("🧾 Seeding orders...");

  const productMap = new Map(productList.map((p) => [p.name, p]));
  // Build menu map: name → { menu, products }
  const menuMap = new Map<
    string,
    { menu: typeof menus.$inferSelect; products: typeof productList }
  >();
  for (const menu of menuList) {
    // Get menu products from DB
    const mps = await db.query.menuProducts.findMany({
      where: eq(menuProducts.menuId, menu.id),
    });
    const menuProds = mps
      .map((mp) => productList.find((p) => p.id === mp.productId))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);
    menuMap.set(menu.name, { menu, products: menuProds });
  }

  let orderCount = 0;

  async function createSeedOrder(orderData: SeedOrder, clientId?: string) {
    const dateKey = getDateKey();
    const ticketResult = await db
      .insert(ticketCounters)
      .values({ tenantId, dateKey, counter: 1 })
      .onConflictDoUpdate({
        target: [ticketCounters.tenantId, ticketCounters.dateKey],
        set: { counter: ticketCounters.counter },
      })
      .returning({ counter: ticketCounters.counter });

    await db
      .update(ticketCounters)
      .set({ counter: (ticketResult[0]?.counter ?? 0) + 1 })
      .where(eq(ticketCounters.dateKey, dateKey));

    const counter = ticketResult[0]?.counter ?? 1;
    const ticketNumber = `${dateKey}:${counter.toString().padStart(3, "0")}`;

    let subtotal = 0;

    // Separate regular items and menu items
    const regularItems = orderData.items.filter(
      (i) => !isMenuOrderItem(i),
    ) as ProductOrderItem[];
    const menuItems = orderData.items.filter(isMenuOrderItem);

    // Regular items
    const regularItemsToInsert = regularItems.map((item) => {
      const product = productMap.get(item.productName);
      const totalPrice = Number(item.price) * item.quantity;
      subtotal += totalPrice;
      return {
        productId: product?.id ?? crypto.randomUUID(),
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: totalPrice.toFixed(2),
        unit: item.unit ?? ("piece" as const),
        isMenu: false,
      };
    });

    // Menu items
    const menuItemsToInsert: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      isMenu: boolean;
      menuProducts: Array<{
        productId: string;
        productName: string;
        quantity: number;
      }>;
    }> = [];

    for (const menuItem of menuItems) {
      const menuData = menuMap.get(menuItem.menuName);
      if (!menuData) {
        console.warn(`⚠️  Menu not found: ${menuItem.menuName}`);
        continue;
      }
      // Calculate price as sum of products if menu has no price
      const unitMenuPrice = menuData.menu.price
        ? Number(menuData.menu.price)
        : menuData.products.reduce((sum, p) => sum + Number(p.price), 0);
      subtotal += unitMenuPrice * menuItem.quantity;

      // Expand into N separate rows so each menu instance can be prepared independently
      for (let i = 0; i < menuItem.quantity; i++) {
        menuItemsToInsert.push({
          productId: menuData.menu.id,
          productName: menuData.menu.name,
          quantity: 1,
          unitPrice: unitMenuPrice.toFixed(2),
          totalPrice: unitMenuPrice.toFixed(2),
          isMenu: true,
          menuProducts: menuData.products.map((p) => ({
            productId: p.id,
            productName: p.name,
            quantity: 1,
          })),
        });
      }
    }

    const taxRate = 0.2;
    const taxTotal = subtotal * taxRate;
    const total = subtotal + taxTotal;

    const [order] = await db
      .insert(orders)
      .values({
        ticketNumber,
        paymentStatus: orderData.paymentStatus,
        preparationStatus: orderData.preparationStatus,
        clientNote: orderData.clientNote ?? null,
        clientId: clientId ?? null,
        pickupDate: orderData.pickupDate ?? null,
        pickupTimeStart: orderData.pickupTimeStart ?? null,
        pickupTimeEnd: orderData.pickupTimeEnd ?? null,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        total: total.toFixed(2),
        tenantId,
      })
      .returning();

    // Insert regular items
    if (regularItemsToInsert.length > 0) {
      await db.insert(orderItems).values(
        regularItemsToInsert.map((item) => ({
          ...item,
          quantity: String(item.quantity),
          orderId: order.id,
        })),
      );
    }

    // Insert menu items + their sub-items
    for (const menuItem of menuItemsToInsert) {
      const [insertedItem] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productId: menuItem.productId,
          productName: menuItem.productName,
          quantity: String(menuItem.quantity),
          unitPrice: menuItem.unitPrice,
          totalPrice: menuItem.totalPrice,
          isMenu: true,
        })
        .returning();

      if (menuItem.menuProducts.length > 0) {
        await db.insert(orderMenuItems).values(
          menuItem.menuProducts.map((mp) => ({
            orderItemId: insertedItem.id,
            productId: mp.productId,
            productName: mp.productName,
            quantity: mp.quantity,
          })),
        );
      }
    }

    orderCount++;
  }

  // Seed regular orders — distribute clients round-robin
  for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
    const client = clientList[i % clientList.length];
    await createSeedOrder(SAMPLE_ORDERS[i], client?.id);
  }

  // Seed menu orders — continue distributing clients
  for (let i = 0; i < MENU_ORDERS.length; i++) {
    const client = clientList[(SAMPLE_ORDERS.length + i) % clientList.length];
    await createSeedOrder(MENU_ORDERS[i], client?.id);
  }

  console.log(
    `✅ Created ${orderCount} orders (including ${MENU_ORDERS.length} with menus)`,
  );
}

function getDateKey(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

async function seedStaff(tenantId: string) {
  console.log("👥 Seeding staff members...");

  const inserted = [];
  for (const staff of STAFF) {
    try {
      const [result] = await db
        .insert(users)
        .values({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          pin: staff.pin,
          role: staff.role,
          isActive: staff.isActive,
          emailVerified: false,
          tenantId,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: staff.name,
            pin: staff.pin,
            role: staff.role,
            isActive: staff.isActive,
            tenantId,
          },
        })
        .returning();
      inserted.push(result);
    } catch (error) {
      console.warn(`⚠️  Could not create staff ${staff.name}:`, error);
    }
  }

  console.log(`✅ Created/updated ${inserted.length} staff members`);
  return inserted;
}

async function seedClients(tenantId: string) {
  console.log("👤 Seeding clients...");

  const clientsToInsert = CLIENTS.map((c) => ({
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    notes: c.notes ?? null,
    tenantId,
  }));

  const inserted = await db.insert(clients).values(clientsToInsert).returning();
  console.log(`✅ Created ${inserted.length} clients`);
  return inserted;
}

// ============ MAIN ============

async function main() {
  console.log("🌱 Starting seed for Fromagerie...\n");

  try {
    // Seed tenant first — everything depends on it
    const tenantId = await seedTenant();
    console.log("");

    await clearDatabase();
    console.log("");

    const staffList = await seedStaff(tenantId);
    const clientList = await seedClients(tenantId);
    const categoryList = await seedCategories(tenantId);
    const productList = await seedProducts(tenantId, categoryList);
    const menuList = await seedMenus(tenantId, productList);
    await seedOrders(tenantId, productList, menuList, clientList);

    console.log("\n🎉 Seed completed successfully!");
    console.log("\nSummary:");
    console.log(`  - Tenant: fromagerie (${tenantId})`);
    console.log(`  - ${staffList.length} staff members`);
    console.log(`  - ${clientList.length} clients`);
    console.log(`  - ${categoryList.length} categories`);
    console.log(`  - ${productList.length} products`);
    console.log(`  - ${MENUS.length} menus`);
    console.log(`  - ${SAMPLE_ORDERS.length} orders`);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
