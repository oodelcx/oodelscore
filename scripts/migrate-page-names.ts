import { connectToDatabase, mongoose } from "../packages/shared/src/db";
import { SiteContent } from "../packages/shared/src/models/SiteContent";

async function migrate() {
  console.log("Connecting to database...");
  await connectToDatabase();

  try {
    console.log("Starting migration: Rename menu items from product/colleague-pulse to customer-x/colleague-x");

    // Update menu navItems to rename keys
    const updateMenuResult = await SiteContent.updateOne(
      { page: "menu" },
      {
        $set: {
          "navItems.$[elem1].key": "customer-x",
          "navItems.$[elem1].label": "Customer X",
          "navItems.$[elem2].key": "colleague-x",
          "navItems.$[elem2].label": "Colleague X",
        },
      },
      {
        arrayFilters: [
          { "elem1.key": "product" },
          { "elem2.key": "colleague-pulse" },
        ],
      }
    );

    console.log("Menu update result:", updateMenuResult);

    if (updateMenuResult.modifiedCount === 0) {
      console.warn("Warning: Menu document was not modified. Checking current state...");
      const menu = await SiteContent.findOne({ page: "menu" });
      if (menu) {
        console.log("Current menu navItems keys:", menu.navItems.map((item: any) => item.key));
      } else {
        console.warn("Menu document not found in database!");
      }
    } else {
      console.log("✓ Menu document updated successfully");
    }

    // Verify the update
    const updatedMenu = await SiteContent.findOne({ page: "menu" });
    if (updatedMenu) {
      console.log("\nUpdated menu navItems:");
      updatedMenu.navItems.forEach((item: any) => {
        console.log(`  - key: ${item.key}, label: ${item.label}`);
      });
    }

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
