import sharp from "sharp";

async function generate() {
  try {
    console.log("Generating og-image.png from og-image.svg using sharp...");
    await sharp("./public/og-image.svg")
      .png()
      .toFile("./public/og-image.png");
    console.log("Success! Created ./public/og-image.png");
  } catch (err) {
    console.error("Error generating PNG:", err);
  }
}

generate();
