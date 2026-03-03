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

const TENANT_NAME = "Glacier du Port";
const TENANT_SLUG = "glacerie";

const CATEGORIES = [
  {
    name: "Glaces classiques",
    description:
      "Nos glaces artisanales aux parfums intemporels. Lait frais et ingrédients de qualité.",
    color: "#F59E0B", // Amber
    sortOrder: 1,
  },
  {
    name: "Sorbets",
    description:
      "Sorbets rafraîchissants aux fruits de saison. Sans lait, sans gluten.",
    color: "#EC4899", // Pink
    sortOrder: 2,
  },
  {
    name: "Spécialités",
    description:
      "Créations originales de notre glacier. Saveurs uniques et audacieuses.",
    color: "#8B5CF6", // Violet
    sortOrder: 3,
  },
  {
    name: "Cornets & Gaufrettes",
    description:
      "Cornets croustillants et gaufrettes maison pour accompagner vos glaces.",
    color: "#D97706", // Orange brown
    sortOrder: 4,
  },
  {
    name: "Toppings & Sauces",
    description: "Garnitures, coulis et sauces pour sublimer vos coupes.",
    color: "#EF4444", // Red
    sortOrder: 5,
  },
  {
    name: "Boissons",
    description: "Milkshakes, smoothies et boissons glacées maison.",
    color: "#06B6D4", // Cyan
    sortOrder: 6,
  },
];

const STAFF = [
  {
    id: "glace-staff-1",
    name: "Lucas Moretti",
    email: "lucas@glacerie.local",
    pin: "1111",
    role: "owner" as const,
    isActive: true,
  },
  {
    id: "glace-staff-2",
    name: "Camille Fontaine",
    email: "camille@glacerie.local",
    pin: "2222",
    role: "staff" as const,
    isActive: true,
  },
  {
    id: "glace-staff-3",
    name: "Théo Blanchard",
    email: "theo@glacerie.local",
    pin: "3333",
    role: "staff" as const,
    isActive: true,
  },
  {
    id: "glace-staff-4",
    name: "Emma Rodriguez",
    email: "emma@glacerie.local",
    pin: "4444",
    role: "admin" as const,
    isActive: true,
  },
];

const CLIENTS = [
  {
    name: "Café de la Plage",
    phone: "04 94 12 34 56",
    email: "contact@cafeplage.fr",
    notes: "Commande bacs 5L tous les lundis",
  },
  {
    name: "Restaurant Le Voilier",
    phone: "04 94 65 43 21",
    email: "cuisine@levoilier.fr",
    notes: "Desserts glacés pour carte été - compte pro",
  },
  {
    name: "Famille Rossi",
    phone: "06 45 67 89 01",
    email: "rossi.famille@email.com",
    notes: "Client fidèle - préfère les sorbets fruits",
  },
  {
    name: "Traiteur Belle Saison",
    phone: "04 94 77 88 99",
    email: "commandes@bellesaison.fr",
    notes: "Pièces montées glacées et verrines pour événements",
  },
  {
    name: "Hôtel Bord de Mer",
    phone: "04 94 33 22 11",
    email: "bar@borddemer.fr",
    notes: "Glaces bar piscine + room service - gros volumes été",
  },
  {
    name: "Mme Petit",
    phone: "06 11 22 33 44",
    email: null,
    notes: "Commande pour anniversaires des petits-enfants",
  },
  {
    name: "École Sainte-Marie",
    phone: "04 94 55 66 77",
    email: "cantine@ecole-ste-marie.fr",
    notes: "Goûters de fin d'année - bons de commande",
  },
  {
    name: "M. Dupuis",
    phone: "06 99 88 77 66",
    email: "rdupuis@email.com",
    notes: "Fan de pistache et praliné",
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
  // Glaces classiques (index 0)
  {
    name: "Vanille de Madagascar",
    description:
      "Glace onctueuse à la vanille bourbon de Madagascar. Notre best-seller.",
    price: "3.50",
    categoryIndex: 0,
    sortOrder: 1,
    stock: "25",
    imageUrl: "https://picsum.photos/seed/vanille/400/300",
  },
  {
    name: "Chocolat noir 70%",
    description:
      "Glace intense au chocolat noir Valrhona. Pour les amateurs de cacao.",
    price: "3.50",
    categoryIndex: 0,
    sortOrder: 2,
    stock: "20",
    imageUrl: "https://picsum.photos/seed/chocolat/400/300",
  },
  {
    name: "Pistache de Sicile",
    description:
      "Glace à la pistache de Bronte, Sicile. Couleur naturelle, goût authentique.",
    price: "4.20",
    categoryIndex: 0,
    sortOrder: 3,
    stock: "12",
    imageUrl: "https://picsum.photos/seed/pistache/400/300",
  },
  {
    name: "Caramel beurre salé",
    description:
      "Glace au caramel maison et beurre salé de Bretagne. Irrésistible.",
    price: "3.80",
    categoryIndex: 0,
    sortOrder: 4,
    stock: "18",
    imageUrl: "https://picsum.photos/seed/caramel/400/300",
  },
  {
    name: "Noisette du Piémont",
    description: "Glace à la noisette IGP du Piémont. Torréfiée et crémeuse.",
    price: "4.20",
    categoryIndex: 0,
    sortOrder: 5,
    stock: "10",
    imageUrl: "https://picsum.photos/seed/noisette/400/300",
  },
  {
    name: "Stracciatella",
    description:
      "Glace fior di latte parsemée de copeaux de chocolat croquants.",
    price: "3.80",
    categoryIndex: 0,
    sortOrder: 6,
    stock: "15",
    imageUrl: "https://picsum.photos/seed/stracciatella/400/300",
  },
  {
    name: "Café",
    description:
      "Glace au café arabica torréfié artisanalement. Intense et aromatique.",
    price: "3.50",
    categoryIndex: 0,
    sortOrder: 7,
    stock: "14",
    imageUrl: "https://picsum.photos/seed/cafe-glace/400/300",
  },
  {
    name: "Yaourt",
    description:
      "Glace au yaourt grecque, légèrement acidulée. Fraîche et légère.",
    price: "3.50",
    categoryIndex: 0,
    sortOrder: 8,
    stock: "16",
    imageUrl: "https://picsum.photos/seed/yaourt/400/300",
  },

  // Sorbets (index 1)
  {
    name: "Sorbet Mangue",
    description: "Sorbet onctueux à la mangue Alfonso. Exotique et parfumé.",
    price: "3.80",
    categoryIndex: 1,
    sortOrder: 1,
    stock: "15",
    imageUrl: "https://picsum.photos/seed/mangue/400/300",
  },
  {
    name: "Sorbet Framboise",
    description:
      "Sorbet vif aux framboises du Lot-et-Garonne. Acidulé et fruité.",
    price: "3.80",
    categoryIndex: 1,
    sortOrder: 2,
    stock: "12",
    imageUrl: "https://picsum.photos/seed/framboise/400/300",
  },
  {
    name: "Sorbet Citron",
    description: "Sorbet au citron de Menton. Rafraîchissant et tonique.",
    price: "3.50",
    categoryIndex: 1,
    sortOrder: 3,
    stock: "20",
    imageUrl: "https://picsum.photos/seed/citron/400/300",
  },
  {
    name: "Sorbet Fruit de la Passion",
    description: "Sorbet exotique au fruit de la passion. Intense et parfumé.",
    price: "4.00",
    categoryIndex: 1,
    sortOrder: 4,
    stock: "8",
    imageUrl: "https://picsum.photos/seed/passion/400/300",
  },
  {
    name: "Sorbet Fraise",
    description: "Sorbet à la fraise Gariguette. Doux et sucré naturellement.",
    price: "3.80",
    categoryIndex: 1,
    sortOrder: 5,
    stock: "0",
    imageUrl: "https://picsum.photos/seed/fraise/400/300",
  },
  {
    name: "Sorbet Coco",
    description: "Sorbet à la noix de coco. Crémeux sans lait, vegan friendly.",
    price: "3.80",
    categoryIndex: 1,
    sortOrder: 6,
    stock: "10",
    imageUrl: "https://picsum.photos/seed/coco/400/300",
  },

  // Spécialités (index 2)
  {
    name: "Tiramisu",
    description:
      "Glace façon tiramisu avec morceaux de biscuit imbibé de café et mascarpone.",
    price: "4.50",
    categoryIndex: 2,
    sortOrder: 1,
    stock: "8",
    imageUrl: "https://picsum.photos/seed/tiramisu/400/300",
  },
  {
    name: "Cookie Dough",
    description:
      "Glace vanille avec morceaux de pâte à cookies et pépites de chocolat.",
    price: "4.50",
    categoryIndex: 2,
    sortOrder: 2,
    stock: "10",
    imageUrl: "https://picsum.photos/seed/cookie/400/300",
  },
  {
    name: "Praliné Feuilleté",
    description: "Glace praliné amande-noisette avec éclats de crêpe dentelle.",
    price: "4.50",
    categoryIndex: 2,
    sortOrder: 3,
    stock: "6",
    imageUrl: "https://picsum.photos/seed/praline/400/300",
  },
  {
    name: "Rhum Raisin",
    description:
      "Glace au rhum vieux avec raisins macérés. Réservée aux adultes.",
    price: "4.20",
    categoryIndex: 2,
    sortOrder: 4,
    stock: "5",
    imageUrl: "https://picsum.photos/seed/rhumraisin/400/300",
  },
  {
    name: "Spéculoos",
    description:
      "Glace aux biscuits spéculoos caramélisés. Croquant et gourmand.",
    price: "4.00",
    categoryIndex: 2,
    sortOrder: 5,
    stock: "12",
    imageUrl: "https://picsum.photos/seed/speculoos/400/300",
  },

  // Cornets & Gaufrettes (index 3)
  {
    name: "Cornet classique",
    description: "Cornet gaufrette croustillant. Le classique indémodable.",
    price: "0.50",
    categoryIndex: 3,
    sortOrder: 1,
    stock: "100",
    imageUrl: "https://picsum.photos/seed/cornet/400/300",
  },
  {
    name: "Cornet chocolat",
    description: "Cornet nappé de chocolat noir à l'intérieur.",
    price: "0.80",
    categoryIndex: 3,
    sortOrder: 2,
    stock: "60",
    imageUrl: "https://picsum.photos/seed/cornet-choco/400/300",
  },
  {
    name: "Gaufre liégeoise",
    description: "Gaufre chaude et moelleuse, garnie de glace et chantilly.",
    price: "2.50",
    categoryIndex: 3,
    sortOrder: 3,
    stock: "30",
    imageUrl: "https://picsum.photos/seed/gaufre/400/300",
  },
  {
    name: "Coupelle gaufrette",
    description: "Coupelle en gaufrette fine pour coupes et sundaes.",
    price: "0.60",
    categoryIndex: 3,
    sortOrder: 4,
    stock: "80",
    imageUrl: "https://picsum.photos/seed/coupelle/400/300",
  },

  // Toppings & Sauces (index 4)
  {
    name: "Chantilly maison",
    description: "Crème fouettée à la vanille, faite minute.",
    price: "1.00",
    categoryIndex: 4,
    sortOrder: 1,
    stock: null,
    imageUrl: "https://picsum.photos/seed/chantilly/400/300",
  },
  {
    name: "Sauce chocolat chaud",
    description: "Chocolat fondu Valrhona servi tiède sur vos glaces.",
    price: "1.50",
    categoryIndex: 4,
    sortOrder: 2,
    stock: null,
    imageUrl: "https://picsum.photos/seed/sauce-choco/400/300",
  },
  {
    name: "Coulis de framboise",
    description: "Coulis de framboises fraîches, légèrement sucré.",
    price: "1.20",
    categoryIndex: 4,
    sortOrder: 3,
    stock: null,
    imageUrl: "https://picsum.photos/seed/coulis/400/300",
  },
  {
    name: "Éclats de noisettes",
    description: "Noisettes du Piémont concassées et torréfiées.",
    price: "1.00",
    categoryIndex: 4,
    sortOrder: 4,
    stock: null,
    imageUrl: "https://picsum.photos/seed/noisettes/400/300",
  },
  {
    name: "Caramel coulant",
    description: "Sauce caramel beurre salé tiède.",
    price: "1.20",
    categoryIndex: 4,
    sortOrder: 5,
    stock: null,
    imageUrl: "https://picsum.photos/seed/caramel-sauce/400/300",
  },
  {
    name: "Meringue italienne",
    description: "Meringue fondante en bac, vendue au poids.",
    price: "22.00",
    categoryIndex: 4,
    sortOrder: 6,
    stock: "3.000",
    imageUrl: "https://picsum.photos/seed/meringue/400/300",
    unitType: "kg",
  },

  // Boissons (index 5)
  {
    name: "Milkshake Vanille",
    description: "Milkshake crémeux à la glace vanille et lait frais.",
    price: "5.50",
    categoryIndex: 5,
    sortOrder: 1,
    stock: null,
    imageUrl: "https://picsum.photos/seed/milkshake-v/400/300",
  },
  {
    name: "Milkshake Chocolat",
    description: "Milkshake onctueux au chocolat noir et lait frais.",
    price: "5.50",
    categoryIndex: 5,
    sortOrder: 2,
    stock: null,
    imageUrl: "https://picsum.photos/seed/milkshake-c/400/300",
  },
  {
    name: "Smoothie Fruits Rouges",
    description: "Smoothie glacé fraise, framboise, myrtille. Sans lait.",
    price: "6.00",
    categoryIndex: 5,
    sortOrder: 3,
    stock: null,
    imageUrl: "https://picsum.photos/seed/smoothie/400/300",
  },
  {
    name: "Café glacé",
    description: "Espresso sur glace vanille avec lait froid. Rafraîchissant.",
    price: "4.50",
    categoryIndex: 5,
    sortOrder: 4,
    stock: null,
    imageUrl: "https://picsum.photos/seed/cafe-glace2/400/300",
  },
  {
    name: "Base sorbet vrac",
    description: "Base sorbet maison vendue en vrac au kg pour professionnels.",
    price: "15.00",
    categoryIndex: 5,
    sortOrder: 5,
    stock: "8.000",
    imageUrl: "https://picsum.photos/seed/sorbet-vrac/400/300",
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
    name: "Coupe Gourmande",
    description:
      "3 boules au choix + chantilly + sauce chocolat + éclats de noisettes.",
    productNames: [
      "Vanille de Madagascar",
      "Chocolat noir 70%",
      "Caramel beurre salé",
      "Chantilly maison",
      "Sauce chocolat chaud",
      "Éclats de noisettes",
    ],
    sortOrder: 1,
  },
  {
    name: "Menu Enfant",
    description:
      "2 boules + cornet chocolat + chantilly. Le bonheur des petits.",
    productNames: [
      "Vanille de Madagascar",
      "Stracciatella",
      "Cornet chocolat",
      "Chantilly maison",
    ],
    sortOrder: 2,
  },
  {
    name: "Banana Split",
    description:
      "3 boules + banane + chantilly + sauce chocolat + éclats de noisettes.",
    productNames: [
      "Vanille de Madagascar",
      "Chocolat noir 70%",
      "Stracciatella",
      "Chantilly maison",
      "Sauce chocolat chaud",
      "Éclats de noisettes",
    ],
    sortOrder: 3,
  },
  {
    name: "Coupe Italienne",
    description:
      "Tiramisu + Pistache + Noisette + coupelle gaufrette. La dolce vita.",
    productNames: [
      "Tiramisu",
      "Pistache de Sicile",
      "Noisette du Piémont",
      "Coupelle gaufrette",
    ],
    sortOrder: 4,
  },
  {
    name: "Menu Goûter",
    description:
      "Gaufre liégeoise + 2 boules + coulis framboise. Le goûter parfait.",
    productNames: [
      "Gaufre liégeoise",
      "Vanille de Madagascar",
      "Caramel beurre salé",
      "Coulis de framboise",
    ],
    sortOrder: 5,
  },
];

const today = new Date();
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

// Order types
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
    items: [{ menuName: "Coupe Gourmande", quantity: 2 }],
    paymentStatus: "paid",
    preparationStatus: "pending",
    clientNote: "2 coupes pour terrasse table 5",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { menuName: "Menu Enfant", quantity: 3 },
      { productName: "Milkshake Vanille", price: "5.50", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Anniversaire enfant - 3 menus + milkshakes",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [{ menuName: "Banana Split", quantity: 4 }],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "4 banana splits pour groupe touristes",
    pickupDate: tomorrow,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [
      { menuName: "Coupe Italienne", quantity: 2 },
      { menuName: "Menu Goûter", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Famille en terrasse - goûter du dimanche",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { menuName: "Coupe Gourmande", quantity: 1 },
      { productName: "Coulis de framboise", price: "1.20", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Supplément coulis framboise sur la coupe",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [{ menuName: "Menu Enfant", quantity: 6 }],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Goûter fin d'année scolaire - 6 menus",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { menuName: "Coupe Italienne", quantity: 1 },
      { menuName: "Banana Split", quantity: 1 },
      { productName: "Café glacé", price: "4.50", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "2 coupes + cafés glacés pour couple",
  },
  {
    items: [{ menuName: "Coupe Gourmande", quantity: 8 }],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "Commande traiteur - desserts pour 8 couverts",
    pickupDate: dayAfterTomorrow,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
];

const SAMPLE_ORDERS: SeedOrder[] = [
  {
    items: [
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 2 },
      { productName: "Chocolat noir 70%", price: "3.50", quantity: 1 },
      { productName: "Cornet classique", price: "0.50", quantity: 3 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "3 cornets simples à emporter",
    pickupDate: today,
    pickupTimeStart: "12:00",
    pickupTimeEnd: "14:00",
  },
  {
    items: [
      { productName: "Pistache de Sicile", price: "4.20", quantity: 2 },
      { productName: "Noisette du Piémont", price: "4.20", quantity: 2 },
      { productName: "Coupelle gaufrette", price: "0.60", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Coupes italiennes pour les parents",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Sorbet Mangue", price: "3.80", quantity: 2 },
      { productName: "Sorbet Fruit de la Passion", price: "4.00", quantity: 2 },
      { productName: "Sorbet Coco", price: "3.80", quantity: 1 },
    ],
    paymentStatus: "pending",
    preparationStatus: "in_preparation",
    clientNote: "Assortiment sorbets exotiques sans lait",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Caramel beurre salé", price: "3.80", quantity: 3 },
      { productName: "Spéculoos", price: "4.00", quantity: 2 },
      { productName: "Chantilly maison", price: "1.00", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "pending",
    clientNote: "Coupes gourmandes caramel pour goûter",
    pickupDate: tomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Tiramisu", price: "4.50", quantity: 2 },
      { productName: "Cookie Dough", price: "4.50", quantity: 2 },
      { productName: "Praliné Feuilleté", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Spécialités pour soirée entre amis",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Milkshake Vanille", price: "5.50", quantity: 2 },
      { productName: "Milkshake Chocolat", price: "5.50", quantity: 2 },
      { productName: "Smoothie Fruits Rouges", price: "6.00", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Milkshakes et smoothie pour groupe ados",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Gaufre liégeoise", price: "2.50", quantity: 4 },
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 4 },
      { productName: "Sauce chocolat chaud", price: "1.50", quantity: 4 },
    ],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "Gaufres glace choco pour 4 personnes",
    pickupDate: dayAfterTomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Sorbet Citron", price: "3.50", quantity: 6 },
      { productName: "Sorbet Framboise", price: "3.80", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Sorbets pour mariage - trou normand",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  // Extra orders for pagination
  {
    items: [
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 1 },
      { productName: "Cornet classique", price: "0.50", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Un simple cornet vanille",
  },
  {
    items: [
      { productName: "Rhum Raisin", price: "4.20", quantity: 2 },
      { productName: "Café", price: "3.50", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Glaces digestif - après repas",
  },
  {
    items: [
      { productName: "Yaourt", price: "3.50", quantity: 3 },
      { productName: "Coulis de framboise", price: "1.20", quantity: 3 },
    ],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "Glaces yaourt coulis pour brunch",
    pickupDate: tomorrow,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Chocolat noir 70%", price: "3.50", quantity: 4 },
      { productName: "Caramel coulant", price: "1.20", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Choco-caramel pour table de 4",
  },
  {
    items: [
      { productName: "Pistache de Sicile", price: "4.20", quantity: 1 },
      { productName: "Noisette du Piémont", price: "4.20", quantity: 1 },
      { productName: "Praliné Feuilleté", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Trio fruits secs pour connaisseur",
    pickupDate: tomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Sorbet Fraise", price: "3.80", quantity: 3 },
      { productName: "Sorbet Mangue", price: "3.80", quantity: 3 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Sorbets fruités pour pique-nique",
  },
  {
    items: [
      { productName: "Cookie Dough", price: "4.50", quantity: 3 },
      { productName: "Cornet chocolat", price: "0.80", quantity: 3 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Cookie dough cornets choco - goûter copains",
  },
  {
    items: [
      { productName: "Stracciatella", price: "3.80", quantity: 2 },
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 2 },
      { productName: "Chantilly maison", price: "1.00", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Coupes blanches classiques",
  },
  {
    items: [{ productName: "Café glacé", price: "4.50", quantity: 4 }],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "4 cafés glacés pour réunion bureau",
  },
  {
    items: [
      { productName: "Spéculoos", price: "4.00", quantity: 2 },
      { productName: "Caramel beurre salé", price: "3.80", quantity: 2 },
      { productName: "Caramel coulant", price: "1.20", quantity: 2 },
    ],
    paymentStatus: "pending",
    preparationStatus: "pending",
    clientNote: "Duo caramel-spéculoos pour soirée crêpes",
    pickupDate: dayAfterTomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Sorbet Coco", price: "3.80", quantity: 2 },
      { productName: "Sorbet Fruit de la Passion", price: "4.00", quantity: 2 },
      { productName: "Sorbet Mangue", price: "3.80", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Assortiment exotique pour dîner thaï",
  },
  {
    items: [
      { productName: "Chocolat noir 70%", price: "3.50", quantity: 3 },
      { productName: "Pistache de Sicile", price: "4.20", quantity: 2 },
      { productName: "Éclats de noisettes", price: "1.00", quantity: 2 },
      { productName: "Sauce chocolat chaud", price: "1.50", quantity: 2 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "Commande restaurant - desserts table 8",
  },
  {
    items: [
      { productName: "Tiramisu", price: "4.50", quantity: 4 },
      { productName: "Café glacé", price: "4.50", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Tiramisu + café glacé - service du soir",
    pickupDate: today,
    pickupTimeStart: "18:00",
    pickupTimeEnd: "20:00",
  },
  {
    items: [
      { productName: "Smoothie Fruits Rouges", price: "6.00", quantity: 6 },
    ],
    paymentStatus: "paid",
    preparationStatus: "pending",
    clientNote: "6 smoothies pour cours de yoga",
    pickupDate: tomorrow,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 5 },
      { productName: "Chocolat noir 70%", price: "3.50", quantity: 5 },
      { productName: "Sorbet Citron", price: "3.50", quantity: 5 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Buffet glaces mariage - 15 boules",
  },
  {
    items: [
      { productName: "Rhum Raisin", price: "4.20", quantity: 1 },
      { productName: "Café", price: "3.50", quantity: 1 },
      { productName: "Praliné Feuilleté", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid",
    preparationStatus: "picked_up",
    clientNote: "Trio adulte classique",
  },
  {
    items: [
      { productName: "Milkshake Chocolat", price: "5.50", quantity: 3 },
      { productName: "Milkshake Vanille", price: "5.50", quantity: 3 },
    ],
    paymentStatus: "paid",
    preparationStatus: "in_preparation",
    clientNote: "6 milkshakes pour fête foraine",
    pickupDate: dayAfterTomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Gaufre liégeoise", price: "2.50", quantity: 2 },
      { productName: "Chocolat noir 70%", price: "3.50", quantity: 2 },
      { productName: "Chantilly maison", price: "1.00", quantity: 2 },
    ],
    paymentStatus: "pending",
    preparationStatus: "in_preparation",
    clientNote: "Gaufres choco-chantilly duo",
    pickupDate: today,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  {
    items: [
      { productName: "Sorbet Framboise", price: "3.80", quantity: 4 },
      { productName: "Coulis de framboise", price: "1.20", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Tout framboise pour fan de framboises",
    pickupDate: tomorrow,
    pickupTimeStart: "14:00",
    pickupTimeEnd: "18:00",
  },
  // Orders with kg products
  {
    items: [
      {
        productName: "Meringue italienne",
        price: "22.00",
        quantity: 0.5,
        unit: "kg" as const,
      },
      { productName: "Vanille de Madagascar", price: "3.50", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "pending",
    clientNote: "Meringue + glace pour vacherin maison",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      {
        productName: "Base sorbet vrac",
        price: "15.00",
        quantity: 2,
        unit: "kg" as const,
      },
      { productName: "Sorbet Citron", price: "3.50", quantity: 6 },
    ],
    paymentStatus: "pending",
    preparationStatus: "in_preparation",
    clientNote: "Base sorbet pro + citrons pour restaurant",
    pickupDate: today,
    pickupTimeStart: "09:00",
    pickupTimeEnd: "12:00",
  },
  {
    items: [
      {
        productName: "Meringue italienne",
        price: "22.00",
        quantity: 0.25,
        unit: "kg" as const,
      },
      { productName: "Chantilly maison", price: "1.00", quantity: 4 },
      { productName: "Coulis de framboise", price: "1.20", quantity: 4 },
    ],
    paymentStatus: "paid",
    preparationStatus: "ready",
    clientNote: "Garnitures pour pavlova maison",
  },
];

// ============ SEED FUNCTIONS ============

async function seedTenant(): Promise<string> {
  console.log("🏢 Seeding tenant...");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: TENANT_NAME,
      slug: TENANT_SLUG,
    })
    .onConflictDoUpdate({
      target: tenants.slug,
      set: { name: TENANT_NAME },
    })
    .returning();

  console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);
  return tenant.id;
}

async function clearTenantData(tenantId: string) {
  console.log("🗑️  Clearing existing data for this tenant...");
  // Delete tenant-specific data only (not other tenants)
  const tenantOrders = await db.query.orders.findMany({
    where: eq(orders.tenantId, tenantId),
    columns: { id: true },
  });
  const orderIds = tenantOrders.map((o) => o.id);

  if (orderIds.length > 0) {
    for (const orderId of orderIds) {
      await db
        .delete(orderMenuItems)
        .where(
          eq(
            orderMenuItems.orderItemId,
            db
              .select({ id: orderItems.id })
              .from(orderItems)
              .where(eq(orderItems.orderId, orderId))
              .limit(1) as any,
          ),
        );
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    }
    for (const orderId of orderIds) {
      await db.delete(orders).where(eq(orders.id, orderId));
    }
  }

  await db.delete(ticketCounters).where(eq(ticketCounters.tenantId, tenantId));

  const tenantMenus = await db.query.menus.findMany({
    where: eq(menus.tenantId, tenantId),
    columns: { id: true },
  });
  for (const menu of tenantMenus) {
    await db.delete(menuProducts).where(eq(menuProducts.menuId, menu.id));
  }
  await db.delete(menus).where(eq(menus.tenantId, tenantId));
  await db.delete(products).where(eq(products.tenantId, tenantId));
  await db.delete(categories).where(eq(categories.tenantId, tenantId));
  await db.delete(clients).where(eq(clients.tenantId, tenantId));
  console.log("  Data cleared for tenant");
}

async function seedCategories(tenantId: string) {
  console.log("📁 Seeding categories...");
  const inserted = await db
    .insert(categories)
    .values(CATEGORIES.map((c) => ({ ...c, tenantId })))
    .returning();
  console.log(`  Created ${inserted.length} categories`);
  return inserted;
}

async function seedProducts(
  tenantId: string,
  categoryList: (typeof categories.$inferSelect)[],
) {
  console.log("🍦 Seeding products...");
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
  console.log(`  Created ${inserted.length} products`);
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

    const menuProductsToInsert = menuData.productNames
      .map((productName, index) => {
        const productId = productMap.get(productName);
        if (!productId) {
          console.warn(`  ⚠️  Product not found: ${productName}`);
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

  console.log(`  Created ${insertedMenus.length} menus`);
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
  const menuMap = new Map<
    string,
    { menu: typeof menus.$inferSelect; products: typeof productList }
  >();
  for (const menu of menuList) {
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

    const regularItems = orderData.items.filter(
      (i) => !isMenuOrderItem(i),
    ) as ProductOrderItem[];
    const menuItems = orderData.items.filter(isMenuOrderItem);

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
        console.warn(`  ⚠️  Menu not found: ${menuItem.menuName}`);
        continue;
      }
      const unitMenuPrice = menuData.menu.price
        ? Number(menuData.menu.price)
        : menuData.products.reduce((sum, p) => sum + Number(p.price), 0);
      subtotal += unitMenuPrice * menuItem.quantity;

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

    if (regularItemsToInsert.length > 0) {
      await db.insert(orderItems).values(
        regularItemsToInsert.map((item) => ({
          ...item,
          quantity: String(item.quantity),
          orderId: order.id,
        })),
      );
    }

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

  for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
    const cl = clientList[i % clientList.length];
    await createSeedOrder(SAMPLE_ORDERS[i], cl?.id);
  }

  for (let i = 0; i < MENU_ORDERS.length; i++) {
    const cl = clientList[(SAMPLE_ORDERS.length + i) % clientList.length];
    await createSeedOrder(MENU_ORDERS[i], cl?.id);
  }

  console.log(
    `  Created ${orderCount} orders (including ${MENU_ORDERS.length} with menus)`,
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
      console.warn(`  ⚠️  Could not create staff ${staff.name}:`, error);
    }
  }

  console.log(`  Created/updated ${inserted.length} staff members`);
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
  console.log(`  Created ${inserted.length} clients`);
  return inserted;
}

// ============ MAIN ============

async function main() {
  console.log(`🍦 Starting seed for ${TENANT_NAME}...\n`);

  try {
    const tenantId = await seedTenant();
    console.log("");

    await clearTenantData(tenantId);
    console.log("");

    const staffList = await seedStaff(tenantId);
    const clientList = await seedClients(tenantId);
    const categoryList = await seedCategories(tenantId);
    const productList = await seedProducts(tenantId, categoryList);
    const menuList = await seedMenus(tenantId, productList);
    await seedOrders(tenantId, productList, menuList, clientList);

    console.log(`\n🎉 Seed completed successfully!`);
    console.log("\nSummary:");
    console.log(`  - Tenant: ${TENANT_SLUG} (${tenantId})`);
    console.log(`  - ${staffList.length} staff members`);
    console.log(`  - ${clientList.length} clients`);
    console.log(`  - ${categoryList.length} categories`);
    console.log(`  - ${productList.length} products`);
    console.log(`  - ${MENUS.length} menus`);
    console.log(`  - ${SAMPLE_ORDERS.length + MENU_ORDERS.length} orders`);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
