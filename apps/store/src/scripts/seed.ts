import {
  categories,
  menuProducts,
  menus,
  orderItems,
  orders,
  products,
  ticketCounters,
} from "@prepareos/data";
import * as schema from "@prepareos/data/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/store";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ============ SEED DATA ============

const CATEGORIES = [
  {
    name: "Fromages à pâte molle",
    description:
      "Fromages onctueux à croûte fleurie ou lavée. Texture crémeuse et fondante.",
    sortOrder: 1,
  },
  {
    name: "Fromages à pâte pressée",
    description: "Fromages à la texture ferme, affinés pendant plusieurs mois.",
    sortOrder: 2,
  },
  {
    name: "Fromages à pâte persillée",
    description: "Fromages bleus avec des veines de moisissures nobles.",
    sortOrder: 3,
  },
  {
    name: "Fromages de chèvre",
    description:
      "Fromages au lait de chèvre, frais ou affinés. Du plus doux au plus corsé.",
    sortOrder: 4,
  },
  {
    name: "Fromages frais",
    description:
      "Fromages non affinés, doux et légers. Parfaits pour les desserts.",
    sortOrder: 5,
  },
  {
    name: "Accompagnements",
    description: "Pain, crackers, fruits secs et autres accompagnements.",
    sortOrder: 6,
  },
];

const PRODUCTS: Array<{
  name: string;
  description: string;
  price: string;
  categoryIndex: number;
  sortOrder: number;
}> = [
  // Pâte molle (index 0)
  {
    name: "Camembert de Normandie AOP",
    description:
      "Camembert au lait cru, affiné 21 jours minimum. Onctueux et savoureux.",
    price: "8.50",
    categoryIndex: 0,
    sortOrder: 1,
  },
  {
    name: "Brie de Meaux AOP",
    description:
      "Le roi des fromages. Pâte souple et crémeuse, croûte fine et fleurie.",
    price: "12.90",
    categoryIndex: 0,
    sortOrder: 2,
  },
  {
    name: "Époisses AOP",
    description:
      "Fromage à croûte lavée au Marc de Bourgogne. Puissant et crémeux.",
    price: "14.50",
    categoryIndex: 0,
    sortOrder: 3,
  },
  {
    name: "Mont d'Or AOP",
    description:
      "Fromage saisonnier dans sa boîte en épicéa. À déguster à la cuillère.",
    price: "18.90",
    categoryIndex: 0,
    sortOrder: 4,
  },
  {
    name: "Reblochon de Savoie AOP",
    description:
      "Fromage savoyard onctueux. Indispensable pour la tartiflette.",
    price: "9.80",
    categoryIndex: 0,
    sortOrder: 5,
  },

  // Pâte pressée (index 1)
  {
    name: "Comté AOP 18 mois",
    description:
      "Affinage long pour des arômes intenses de fruits secs et de noisette.",
    price: "24.90",
    categoryIndex: 1,
    sortOrder: 1,
  },
  {
    name: "Comté AOP 36 mois",
    description:
      "Exceptionnelle complexité aromatique. Cristaux de tyrosine présents.",
    price: "38.50",
    categoryIndex: 1,
    sortOrder: 2,
  },
  {
    name: "Beaufort d'été AOP",
    description:
      "Fromage des alpages, au lait des vaches broutant les fleurs d'altitude.",
    price: "32.00",
    categoryIndex: 1,
    sortOrder: 3,
  },
  {
    name: "Tomme de Savoie IGP",
    description:
      "Fromage de montagne à la croûte grise. Saveur douce et fruitée.",
    price: "16.50",
    categoryIndex: 1,
    sortOrder: 4,
  },
  {
    name: "Cantal Entre-Deux AOP",
    description:
      "Affinage de 3 à 7 mois. Équilibre parfait entre douceur et caractère.",
    price: "14.90",
    categoryIndex: 1,
    sortOrder: 5,
  },
  {
    name: "Ossau-Iraty AOP",
    description:
      "Fromage basque au lait de brebis. Notes de noisette et de caramel.",
    price: "22.50",
    categoryIndex: 1,
    sortOrder: 6,
  },

  // Pâte persillée (index 2)
  {
    name: "Roquefort AOP",
    description:
      "Le roi des bleus. Affiné dans les caves de Roquefort-sur-Soulzon.",
    price: "26.90",
    categoryIndex: 2,
    sortOrder: 1,
  },
  {
    name: "Bleu d'Auvergne AOP",
    description: "Persillé équilibré et crémeux. Plus doux que le Roquefort.",
    price: "18.50",
    categoryIndex: 2,
    sortOrder: 2,
  },
  {
    name: "Fourme d'Ambert AOP",
    description:
      "Le plus doux des bleus français. Texture fondante et goût délicat.",
    price: "16.90",
    categoryIndex: 2,
    sortOrder: 3,
  },
  {
    name: "Bleu de Gex AOP",
    description: "Bleu du Jura à la saveur subtile et légèrement amère.",
    price: "19.50",
    categoryIndex: 2,
    sortOrder: 4,
  },

  // Chèvre (index 3)
  {
    name: "Crottin de Chavignol AOP",
    description: "Petit fromage de chèvre du Berry. Du plus frais au plus sec.",
    price: "4.50",
    categoryIndex: 3,
    sortOrder: 1,
  },
  {
    name: "Sainte-Maure de Touraine AOP",
    description:
      "Bûche cendrée traversée d'une paille de seigle. Onctueux et typé.",
    price: "8.90",
    categoryIndex: 3,
    sortOrder: 2,
  },
  {
    name: "Valençay AOP",
    description:
      "Pyramide tronquée cendrée. Légende napoléonienne et goût délicat.",
    price: "9.50",
    categoryIndex: 3,
    sortOrder: 3,
  },
  {
    name: "Rocamadour AOP",
    description: "Petit palet du Quercy. Doux et crémeux quand il est jeune.",
    price: "3.90",
    categoryIndex: 3,
    sortOrder: 4,
  },
  {
    name: "Picodon AOP",
    description: "Petit fromage ardéchois au goût prononcé. Affiné en cave.",
    price: "4.20",
    categoryIndex: 3,
    sortOrder: 5,
  },

  // Fromages frais (index 4)
  {
    name: "Faisselle fermière",
    description:
      "Fromage frais en faisselle. Léger et rafraîchissant avec du miel.",
    price: "4.50",
    categoryIndex: 4,
    sortOrder: 1,
  },
  {
    name: "Brousse du Rove",
    description: "Fromage frais au lait de chèvre du Rove. Texture aérienne.",
    price: "6.90",
    categoryIndex: 4,
    sortOrder: 2,
  },
  {
    name: "Fontainebleau",
    description:
      "Fromage frais battu à la crème. Dessert gourmand avec des fruits.",
    price: "5.50",
    categoryIndex: 4,
    sortOrder: 3,
  },
  {
    name: "Cervelle de Canut",
    description: "Spécialité lyonnaise au fromage blanc, herbes et échalotes.",
    price: "5.90",
    categoryIndex: 4,
    sortOrder: 4,
  },

  // Accompagnements (index 5)
  {
    name: "Pain aux noix artisanal",
    description: "Pain rustique aux noix, parfait avec les fromages.",
    price: "4.50",
    categoryIndex: 5,
    sortOrder: 1,
  },
  {
    name: "Crackers aux graines",
    description: "Assortiment de crackers aux graines de lin et sésame.",
    price: "3.90",
    categoryIndex: 5,
    sortOrder: 2,
  },
  {
    name: "Confiture de figues",
    description: "Confiture artisanale de figues. Accord parfait avec le bleu.",
    price: "6.50",
    categoryIndex: 5,
    sortOrder: 3,
  },
  {
    name: "Miel de montagne",
    description: "Miel toutes fleurs des Pyrénées. Pour les chèvres frais.",
    price: "8.90",
    categoryIndex: 5,
    sortOrder: 4,
  },
  {
    name: "Fruits secs assortis",
    description: "Mélange de noix, noisettes, amandes et abricots secs.",
    price: "7.50",
    categoryIndex: 5,
    sortOrder: 5,
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

// Sample orders data
const SAMPLE_ORDERS = [
  {
    items: [
      { productName: "Comté AOP 18 mois", price: "24.90", quantity: 1 },
      { productName: "Camembert de Normandie AOP", price: "8.50", quantity: 2 },
      { productName: "Pain aux noix artisanal", price: "4.50", quantity: 1 },
    ],
    paymentStatus: "paid" as const,
    preparationStatus: "picked_up" as const,
    clientNote: "Pour un plateau apéritif",
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
  },
];

// ============ SEED FUNCTIONS ============

async function clearDatabase() {
  console.log("🗑️  Clearing existing data...");
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(ticketCounters);
  await db.delete(menuProducts);
  await db.delete(menus);
  await db.delete(products);
  await db.delete(categories);
  console.log("✅ Database cleared");
}

async function seedCategories() {
  console.log("📁 Seeding categories...");
  const inserted = await db.insert(categories).values(CATEGORIES).returning();
  console.log(`✅ Created ${inserted.length} categories`);
  return inserted;
}

async function seedProducts(categoryList: (typeof categories.$inferSelect)[]) {
  console.log("🧀 Seeding products...");
  const productsToInsert = PRODUCTS.map((p) => ({
    name: p.name,
    description: p.description,
    price: p.price,
    categoryId: categoryList[p.categoryIndex]?.id ?? null,
    sortOrder: p.sortOrder,
    isActive: true,
  }));

  const inserted = await db
    .insert(products)
    .values(productsToInsert)
    .returning();
  console.log(`✅ Created ${inserted.length} products`);
  return inserted;
}

async function seedMenus(productList: (typeof products.$inferSelect)[]) {
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

async function seedOrders(productList: (typeof products.$inferSelect)[]) {
  console.log("🧾 Seeding orders...");

  const productMap = new Map(productList.map((p) => [p.name, p]));
  let orderCount = 0;

  for (const orderData of SAMPLE_ORDERS) {
    // Generate ticket number
    const dateKey = getDateKey();
    const ticketResult = await db
      .insert(ticketCounters)
      .values({ dateKey, counter: 1 })
      .onConflictDoUpdate({
        target: ticketCounters.dateKey,
        set: { counter: ticketCounters.counter },
      })
      .returning({ counter: ticketCounters.counter });

    // Increment counter for next order
    await db
      .update(ticketCounters)
      .set({ counter: (ticketResult[0]?.counter ?? 0) + 1 })
      .where((await import("drizzle-orm")).eq(ticketCounters.dateKey, dateKey));

    const counter = ticketResult[0]?.counter ?? 1;
    const ticketNumber = `${dateKey}:${counter.toString().padStart(3, "0")}`;

    // Calculate totals
    let subtotal = 0;
    const itemsToInsert = orderData.items.map((item) => {
      const product = productMap.get(item.productName);
      const unitPrice = item.price;
      const totalPrice = Number(unitPrice) * item.quantity;
      subtotal += totalPrice;
      return {
        productId: product?.id ?? crypto.randomUUID(),
        productName: item.productName,
        quantity: item.quantity,
        unitPrice,
        totalPrice: totalPrice.toFixed(2),
      };
    });

    const taxRate = 0.2;
    const taxTotal = subtotal * taxRate;
    const total = subtotal + taxTotal;

    // Create order
    const [order] = await db
      .insert(orders)
      .values({
        ticketNumber,
        paymentStatus: orderData.paymentStatus,
        preparationStatus: orderData.preparationStatus,
        clientNote: orderData.clientNote ?? null,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        total: total.toFixed(2),
      })
      .returning();

    // Add order items
    await db.insert(orderItems).values(
      itemsToInsert.map((item) => ({
        ...item,
        orderId: order.id,
      })),
    );

    orderCount++;
  }

  console.log(`✅ Created ${orderCount} orders`);
}

function getDateKey(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

// ============ MAIN ============

async function main() {
  console.log("🌱 Starting seed for Fromagerie...\n");

  try {
    await clearDatabase();
    console.log("");

    const categoryList = await seedCategories();
    const productList = await seedProducts(categoryList);
    await seedMenus(productList);
    await seedOrders(productList);

    console.log("\n🎉 Seed completed successfully!");
    console.log("\nSummary:");
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
