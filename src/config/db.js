const mongoose = require("mongoose");

// Database connection configuration
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`[Success] MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Error] MongoDB Connection Failed: ${error.message}`);
    console.error(
      "   → Check your MONGO_URI in .env (should be a valid Atlas SRV string)",
    );
    process.exit(1);
  }
};

module.exports = connectDB;
