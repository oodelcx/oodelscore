const mongoose = require("mongoose");

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Error: MONGODB_URI environment variable not set");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);

  try {
    const db = mongoose.connection.db;
    const collection = db.collection("sitecontents");

    console.log("Starting migration: Rename menu items from product/colleague-pulse to customer-x/colleague-x");

    // Update menu navItems to rename keys and labels
    const updateMenuResult = await collection.updateOne(
      { page: "menu" },
      [
        {
          $set: {
            navItems: {
              $map: {
                input: "$navItems",
                as: "item",
                in: {
                  $cond: [
                    { $eq: ["$$item.key", "product"] },
                    { ...["$$item"], key: "customer-x", label: "Customer X" },
                    {
                      $cond: [
                        { $eq: ["$$item.key", "colleague-pulse"] },
                        { ...["$$item"], key: "colleague-x", label: "Colleague X" },
                        "$$item"
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    );

    console.log("Menu update result:", updateMenuResult);

    if (updateMenuResult.modifiedCount === 0) {
      console.warn("Warning: Menu document was not modified. Checking current state...");
    } else {
      console.log("✓ Menu document updated successfully");
    }

    // Verify the update
    const menu = await collection.findOne({ page: "menu" });
    if (menu && menu.navItems) {
      console.log("\nUpdated menu navItems:");
      menu.navItems.forEach((item) => {
        console.log(`  - key: ${item.key}, label: ${item.label}, visible: ${item.visible}`);
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
